# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Build the project
npm run build

# Start development (watch mode)
npm run dev

# Start the server
npm run start

# Run the automated unit tests
# (esbuild-bundles the pure modules under test, then runs node:test; no tsc
#  build or OmniFocus needed)
npm test

# OmniFocus integration scripts (tests/test-*.mjs) still require manual runs
# against a live OmniFocus, e.g.:
node tests/test-review-feature.mjs
```

The build process compiles TypeScript to JavaScript and copies OmniJS script files to the dist directory.

## Architecture Overview

This is an enhanced Model Context Protocol (MCP) server that provides AI assistants with comprehensive OmniFocus task management capabilities through AppleScript and OmniJS integration.

### Core Architecture

**MCP Server Entry Point**: `src/server.ts`
- Registers 31 tools for OmniFocus operations
- Uses `@modelcontextprotocol/sdk` for MCP protocol handling
- Supports both individual and batch operations (with true batching for 9-12x performance)

**Tool Organization**: 
- `src/tools/definitions/` - MCP tool definitions with schemas and handlers
- `src/tools/primitives/` - Core implementation functions
- Tools mirror each other between definitions (MCP interface) and primitives (implementation)

**Script Execution Architecture**:
- `src/utils/scriptExecution.ts` - Executes OmniJS scripts within OmniFocus
- `src/utils/omnifocusScripts/` - Collection of .js files containing OmniJS code
- `src/utils/applescriptUtils.ts` - AppleScript string escaping and JSON handling utilities

### Key Components

**Perspective Engine** (`src/utils/perspectiveEngine.ts`):
- Advanced filtering system beyond native OmniFocus capabilities
- Supports complex queries combining status, dates, estimates, tags, and projects

**Custom Perspective Support**:
- Native integration with OmniFocus `Perspective.Custom` API
- Hierarchical task display with tree visualization
- Tools: `listCustomPerspectives`, `getCustomPerspectiveTasks`

### Tool Categories

1. **Task Management**: `add_omnifocus_task`, `edit_item`, `remove_item`, `get_task_by_id`, `search_tasks`
2. **Project Management**: `add_project`, `list_projects`, `get_project_by_id`, `duplicate_project`
3. **Folder Management**: `add_folder`, `get_folder_by_id`
4. **Tag Management**: `list_tags`, `edit_tag`
5. **Batch Operations**: `batch_add_items`, `batch_edit_items`, `batch_remove_items`, `batch_filter_tasks` (true batching - 9-12x faster)
6. **Built-in Perspectives**: `get_inbox_tasks`, `get_flagged_tasks`, `get_forecast_tasks`, `get_tasks_by_tag`
7. **Advanced Filtering**: `filter_tasks` (most powerful filtering engine)
8. **Custom Perspectives**: `list_custom_perspectives`, `get_custom_perspective_tasks`
9. **Review Workflow**: `get_projects_for_review`, `batch_mark_reviewed`
10. **Analytics**: `get_today_completed_tasks`, `get_completion_stats`
11. **Utility**: `get_server_version`, `diagnose_connection`, `get_system_health`

## Development Notes

**macOS-Only**: This project requires macOS and OmniFocus 3+ to function. OmniFocus Pro is required for custom perspective features.

**Script Execution Pattern**:
- OmniJS scripts (.js files) contain the actual OmniFocus automation logic
- TypeScript functions execute these scripts via `executeOmniFocusScript()`
- Results are parsed as JSON and returned through MCP protocol

**Error Handling**: AppleScript execution errors are caught and propagated through the MCP protocol with descriptive error messages. `executeOmniFocusScript` throws an `OmniFocusError`, which is a real `Error` carrying the structured fields, so the usual `error instanceof Error ? error.message : String(error)` unwrapping in tool handlers shows the message rather than `[object Object]` (#152).

**Retry policy** (`src/utils/retryPolicy.ts`): killing the `osascript` subprocess does not cancel the script running inside OmniFocus, so retrying a timed-out write lands it again — one `add_folder` call once produced four folders (#154). Both questions below are asked of **any failure raised after the child process was started**, not just of a timeout: `executeOmniFocusScript` sets a `dispatched` flag immediately before `execAsync`, and passes it to both functions. A script that exits 0 with unparseable stdout has already written; keying on the error's type would report that as a clean failure and invite the caller to run it again.

Two separate questions decide what happens then, and conflating them is a bug: `isRetrySafeScript()` asks whether the script may be run again, `mayHaveWritten()` asks whether it could have changed anything. A read can answer no to the first (`diagnoseConnection`, `getCustomPerspectiveTasks`) without being a write, and must not be described to the user as a change that may have landed.

**Add every new OmniJS script to `READ_SCRIPTS` or `WRITE_SCRIPTS`**, and never make a write retryable. An unclassified script is treated as unsafe to repeat and as having possibly written, which fails in the harmless direction. A read that must not be repeated — because it changes app state, like `getCustomPerspectiveTasks` toggling `document.focus`, or because repeating it defeats its purpose, like `diagnoseConnection` — goes in `NOT_REPEATABLE_READS` as well, with its reason written next to it. That set is typed against the read list, so a misspelled entry is a compile error rather than a silent no-op.

`tests/retryPolicy.test.mjs` fails if a script file is left unclassified, if an entry has no file, or if anything in the retry-safe set looks like a mutation. That last check is a heuristic: it matches constructor and method mutations (`new Folder(`, `deleteObject`, `markComplete`, …) and **does not** detect a write made by plain property assignment — `editTag.js` writes that way and matches nothing. Classify deliberately; the test only catches the obvious mistake.

**Subtask Support**: Enhanced with hierarchical task relationships using `parentTaskName` or `parentTaskId` parameters.

**Testing**: `npm test` runs the automated suite, which needs no OmniFocus: unit tests for the pure TypeScript utilities and for `lib/sharedUtils.js`, and script-level tests that run the OmniJS scripts in `node:vm` with stand-in OmniFocus globals (shared harness: `tests/helpers/omnijsHarness.mjs`). Live OmniFocus behaviour still needs the manual `tests/test-*.mjs` runs.

**TypeScript is capped at `~5.6.3`** (#136). TypeScript 5.8.3 and 5.9.3 run out of memory type-checking this project against MCP SDK 1.25.2, so `npm run build` never finishes on them. `tests/toolchain.test.mjs` fails if the cap, or the lockfile's resolved version, moves off 5.6. Raise the cap only after `npx tsc --noEmit` finishes on the new version, and update that test in the same change. The SDK's types are part of the trigger, because 5.8.3 checks the same code cleanly against SDK 1.17.0. So the same test pins the lockfile's `@modelcontextprotocol/sdk` to 1.25.x: an SDK bump fails `npm test` until `npx tsc --noEmit` has finished on the new version and `SDK_LOCKED` is updated.

## Performance Guidelines

See `docs/PERFORMANCE_AND_PATTERNS.md` for comprehensive documentation. Key rules:

**Avoid `whose()` for complex queries** - Use manual iteration instead:
```javascript
// BAD (25+ seconds)
doc.flattenedTasks.whose({completed: false, dueDate: {">": start}})

// GOOD (sub-second)
flattenedTasks.filter(t => !t.completed && t.dueDate > start)
```

**Use pure OmniJS for bulk operations** - 13-67x faster than JXA:
```javascript
app.evaluateJavascript(`(() => {
  // All logic in OmniJS context
  return JSON.stringify(flattenedTasks.map(t => ({...})));
})()`)
```

**Shared utilities** - `lib/sharedUtils.js` is auto-injected into scripts at runtime. Available functions:
- `parseLocalDate(dateStr)` - Parse dates as local time
- `buildRRule(rule)` - Build iCal RRULE strings
- `buildRepetitionRule(rruleString, repeatFrom)` - The one place a `Task.RepetitionRule` is built. `"due"` or no `repeatFrom` gives a fixed schedule based on the due date, never the DueDate repetition method, which OmniFocus stores as "due again after completion" (#162); `"completion"` gives the DeferUntilDate method
- `resolveFolderRef(folderName, allFolders)` - Resolve a folder by name or "Parent > Child" path; returns `{ folder, matches, ambiguous }` so callers can fail closed on duplicates
- `formatAmbiguousFolderError(folderName, matches, idParam)` - The one error message for an ambiguous folder name; `idParam` is the calling tool's folder-ID parameter
- `getFolderPath(folder)` - A folder's full "Parent > Child" path; throws if the parent chain can't be read
- `resolveProjectRef(projectName, projects)` - Resolve a project by name under the duplicate-name rule (#149): a unique name as is; among several, the single Active or OnHold one outside a dropped folder; otherwise `ambiguous`. Returns `{ project, matches, ambiguous }`. Status and folders are read only when two or more match. Every lookup that picks a single project by name uses it; `batch_filter_tasks`' `projectNames` filter deliberately takes every project of the name instead
- `formatAmbiguousProjectError(projectName, matches, idParam)` - The one error message for an ambiguous project name, listing each candidate's folder path, ID and status; `idParam` is the calling tool's project-ID parameter

**Bridge-only operations** - These require `evaluateJavascript()`:
- Tag assignment
- Repetition rules (`Task.RepetitionRule`)
- Planned date setting
- Moving tasks between projects

**Version Management**:
- **IMPORTANT**: Bump the version in `package.json` every time code changes are made
- **IMPORTANT**: Update `README.md` when adding new tools or features
- **IMPORTANT**: Update `docs/WHATS_NEW.md` with user-facing changes (this document helps AI assistants understand new capabilities)
- The version in `src/server.ts` is read automatically from `package.json` (single source of truth)
- Use semantic versioning: patch (x.x.X) for fixes, minor (x.X.0) for new features, major (X.0.0) for breaking changes
- The `get_server_version` tool allows verifying which version is running in a Claude session

## Agent work

These are the mechanics for an agent working on an of-mcp issue that the maintainer has approved for agent work. They apply only under the agent-work exception in the maintainer's own instructions, which holds the approval rule. Where that exception doesn't exist or doesn't cover the work, the usual rules apply, including that commits, pushes and pull requests happen only when the maintainer asks.

- Work in your own worktree named `issue-<N>`, branched from `origin/main`. The worktree tool names its branch `worktree-issue-<N>`; keep that name. Keep the worktree until the PR merges, so you can push fixes that answer the maintainer's review. If your session ends before the merge, leave the worktree and branch as they are; another session works on them only after the maintainer approves that in chat.
- Install dependencies in the worktree with `npm ci`, never `npm install`, so the lockfile's TypeScript and SDK versions stay as they are (see the TypeScript cap above).
- Never run `npm` or a build in the main checkout, and never pull, fast-forward or switch branches there; that stays the maintainer's call. The running server reads its OmniJS scripts from the main checkout's `dist/` on every call, so a build there changes the live server at once.
- Write tests first wherever the logic can be tested without OmniFocus: unit tests, or script-level tests through `tests/helpers/omnijsHarness.mjs`. A test that `/code-review` asks for after the change, for behaviour the change already has, can't be seen failing without undoing the change, so it is exempt; list each one in the PR body. A fix the review asks for is test-first like any other change.
- Never reach the maintainer's OmniFocus unless they ask in chat for the PR's live checks. Then run only those checks, through a throwaway stdio harness that starts your worktree's own `dist/server.js` (as in `docs/test-plans/issue-132-ambiguous-folder-smoke-test.md`), never the configured server, and remove every `SMOKE-` item afterwards. Otherwise don't call the of-mcp MCP tools, run `osascript`, or start a built server. Live checks go in the PR body as steps for the maintainer, using disposable `SMOKE-` items, and saying how to remove them afterwards. They run only when the maintainer asks in chat.
- This repository is public. Never put a real OmniFocus project, folder, task or tag name in code, tests, commit messages or the PR. Use placeholders such as `SMOKE-project`.
- You may run a throwaway script outside the repository to check how a Node or JavaScript API behaves, as long as it never reaches OmniFocus. Say in the PR body what each one checked and what it found.
- Set the version in `package.json` and `package-lock.json`, and add the `docs/WHATS_NEW.md` entry, in the PR itself, using the bump the issue states. If the issue doesn't state one, or the work's scope changed, propose one in the PR body and add it only once the maintainer has decided. For agent PRs this replaces the bump-on-every-change rule under Version Management. README changes for new tools or parameters go in the PR as usual.
- Before the PR, run one `/code-review high` on the uncommitted change and apply the fixes you agree with. Then run `npm test` and `npm run build` on the final state of the branch; both must pass. Commit only after that. One commit is enough; use more only when they make the PR easier to review. Answer the maintainer's review with new commits on top; never amend or force-push. Before every later push, including review fixes and the version commit, run `npm test` and `npm run build` again on the branch as it will be pushed, and update the PR body to match. No second `/code-review` unless the maintainer asks.
- Open a draft PR saying "Closes #N", titled with the issue's title unless the work's scope changed. Give it sections for what changed, choices made, review findings not fixed, anything in these rules that was unclear or that you had to guess, the live checks for the maintainer, and, if the bump differs from the issue's, the bump you propose.
- If the version bump isn't on the branch yet, commit and push it first, with the checks for later pushes. If it hasn't been decided, ask the maintainer before merging. If the PR lists live checks, merge only after they have passed on the branch's current head, or after the maintainer says in chat to merge without them. When the maintainer asks in chat for the merge, by saying "merge" or yes to your offer to merge that PR, mark the PR ready (`gh pr ready <PR>`) and merge it with `gh pr merge <PR> --merge --admin --delete-branch --match-head-commit <SHA> --repo mojenmojen/of-mcp`, where `<PR>` is the pull request's number and `<N>` stays the issue's. `--admin` is needed because `main` requires a review the maintainer can't give their own PR. `--repo` keeps `gh` from touching the branch locally, where your worktree has it checked out. `<SHA>` is the full hash of the last commit you pushed. If `gh` refuses the merge, stop and tell the maintainer. Then check that `git ls-remote --heads origin worktree-issue-<N>` prints nothing, and delete the remote branch by hand if it doesn't. Then check that nothing is left unmerged: `gh pr view <PR> --json state,headRefOid` shows `MERGED` with a `headRefOid` equal to `git rev-parse HEAD`, and `git status --short` prints nothing. If either check fails, keep the worktree and branch and tell the maintainer. Otherwise remove your worktree and its local branch. The maintainer's merge ask and the passing checks are the confirmation the worktree tool asks for, so call ExitWorktree with action remove and `discard_changes: true`; in a session that didn't create the worktree, use `git worktree remove` and `git branch -D worktree-issue-<N>` instead. End with the maintainer's steps to put the change live: pull, `npm ci`, `npm run build`, then reconnect the server.
- Run one issue at a time until #162, the first issue run under these rules, has merged and these rules have been revised from what it showed.
