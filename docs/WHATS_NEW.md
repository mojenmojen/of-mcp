# OmniFocus MCP Server - What's New (v1.34.0)

> Summary of changes from Sprints 1-10 for AI assistants using this MCP server.

## v1.34.0 Ambiguous folder names now fail closed (#142)

Passing a plain folder name (`folderName`, `newFolderName` or `parentFolderName`) that matches more than one folder previously resolved to whichever folder came first in outline order, silently. Tools now return an explicit error naming every candidate by its full path and folder ID, for example:

> Folder name "Archive" is ambiguous - 2 folders match: "Clients > Archive" (id: abc123), "Archive" (id: def456). Use the full "Parent > Child" path, or pass folderId.

**This is a breaking change** for callers that relied on first-match with duplicate folder names. Unique folder names are unaffected. Disambiguate with the `"Parent > Child"` path syntax or with `folderId`. When path syntax can't tell the duplicates apart, as with a top-level folder that shares its name with a nested one, pass the candidate's ID from the error instead (`folderId`, `newFolderId` or `parentFolderId`).

Affected tools: `add_project`, `add_folder` (`parentFolderName`), `batch_add_items`, `edit_item`, `batch_edit_items`, `duplicate_project`, `list_projects`, `get_folder_by_id`.

**Known limitation:** when every item in a `batch_add_items` or `batch_edit_items` call fails, the tool currently shows a generic error instead of each item's message, so a batch whose only item names an ambiguous folder fails safely but doesn't show the candidates. Batches where at least one item succeeds show every message. Tracked in #146.

Closes #132. This removes the root-cause class behind #112, where a duplicate folder name (one copy dropped) caused projects to be created in the dropped folder, making them and their tasks invisible to active queries.

---

## v1.33.0 Build-staleness gate: `get_server_version` reports build provenance (#126)

`get_server_version` now returns a `build` object alongside the version string: `commit` (short SHA baked in at build time), `dirty` (whether the working tree had uncommitted or untracked changes), `contentHash` (a hash of compiled output), and `buildStale` (true when the running process was launched from an older build than what is currently on disk).

A matching version number is no longer sufficient evidence that the right code is running. `buildStale: true` signals that the server process predates the on-disk build and needs a restart. `buildStale: false` confirms the process matches the disk build, but you still need to compare `build.commit` against `git rev-parse --short HEAD` to confirm the disk build itself came from the intended source.

---

## v1.32.2 Harden TS date parsing: shared `parseLocalDate` helper + timezone unit tests (#119)

Follow-up to #114 — internal hardening plus one small forecast display fix.

The bare-`YYYY-MM-DD` → local-`Date` parsing that #114 added inline in two TypeScript spots (`formatDateSafe` and the forecast classifier) is now consolidated into a single exported `parseLocalDate(dateString)` in `src/utils/dateUtils.ts` — the TS-side parallel to the OmniJS `parseLocalDate()` in `lib/sharedUtils.js`, hardened to return `null` for missing or invalid input (and to round-trip years 0–99 rather than mapping them to the 1900s). `formatDateSafe` now delegates to it, and the forecast OVERDUE/TODAY/TOMORROW/FUTURE bucketing is extracted into a pure, testable `classifyForecastDate(date, now)`.

**Forecast fix:** `classifyForecastDate` now uses calendar arithmetic for "tomorrow" instead of a fixed `+24h`, so on the two daylight-saving transition days a year the day after the change is again labelled `⏰ TOMORROW` rather than a plain weekday header. The forecast summary count also reflects only the dates actually rendered.

**First automated tests.** `npm test` runs a timezone unit suite (`tests/dateUtils.test.mjs`, Node's built-in `node:test`, no new dependencies) that exercises the bare-date path under both a UTC− zone (`America/Los_Angeles`) and a UTC+ zone (`Australia/Sydney`), asserting cross-zone (and DST-transition) invariance rather than locale-specific strings. It builds the one pure module under test with esbuild, since the full `tsc` build is known to hang on some setups (see `build:fast`). This locks in the #114 fix and the invalid-date guard added during its review, which were previously invisible to any UTC-based run. The OmniFocus integration scripts (`tests/test-*.mjs`) remain manual.

---

## v1.32.1 Fix `get_completion_stats` period echo off-by-one for UTC+ users (#118)

**`get_completion_stats` now echoes `period.start` / `period.end` as the correct local date for UTC+ users.**
The script built the echoed range with `completedAfter.toISOString().split('T')[0]`. Because `completedAfter` / `completedBefore` are local-midnight `Date` objects from `parseLocalDate(...)`, `toISOString()` converts them back to UTC — in a UTC+10 environment, local midnight April 28 became `"2026-04-27"`, reporting the range a day early. The keys are now built from local year/month/date components via a shared `toLocalDateKey(date)` helper in `lib/sharedUtils.js`.

**Display-only.** This affected only the echoed range in the response, not which tasks were counted — the completion-date comparisons use the `Date` objects directly and were always correct. Same bug class as the forecast fix in #114.

---

## v1.32.0 Folder path disambiguation and server version fix

**Folder path disambiguation:**
- All tools accepting `folderName` now support `"Parent > Child"` path syntax to disambiguate folders with the same name at different hierarchy levels (e.g., `"Work > Areas"` vs `"Personal > Areas"`)
- Plain folder names still work (first match, backwards compatible) *(Superseded in v1.34.0: a plain name that matches more than one folder now fails with an error listing each candidate.)*
- Affected tools: `get_folder_by_id`, `add_project`, `add_folder`, `edit_item`, `duplicate_project`, `batch_add_items`, `batch_edit_items`, `list_projects`

**Full folder paths in output:**
- `list_projects` now returns full folder paths (e.g., `"Work > Areas"`) instead of bare names (`"Areas"`)
- `get_folder_by_id` now includes a `path` field in its response

**Stricter folder filtering in `list_projects`:**
- When a `folderName` filter doesn't resolve (typo, deleted folder, or an ambiguous name), `list_projects` now returns an explicit `Folder not found` error instead of silently returning *every* project. This matches the existing fail-closed behaviour of `add_project`, `duplicate_project`, and `get_folder_by_id`. *(Superseded in v1.34.0 for ambiguous names, which now get their own error listing each candidate.)*

**Server version fix:**
- `get_server_version` no longer fails with ENOENT when the MCP server runs from a directory without a `package.json`

---

## v1.31.0 Expose subtasks in get_task_by_id response

**`get_task_by_id` now returns a `children` array** containing one level of direct subtasks for any task that has them. Each child entry includes: `id`, `name`, `completed`, `dropped`, `flagged`, `dueDate`, `deferDate`, `hasChildren`, and `childrenCount`. The parent response also includes `hasChildren` and `childrenCount` fields so you can detect deep hierarchies without fetching children.

**Display:** The tool output now shows subtasks with status icons (✅ completed, 🗑️ dropped, ⚪ active) and flags nesting depth with `(+N more)` when a child itself has children.

**Depth cap:** Only direct children are returned. Grandchildren are not enumerated — use `get_task_by_id` on a child's ID to traverse further.

**Robustness:** If children can't be loaded (e.g. during an OmniFocus sync), `children` defaults to `[]` and a `childrenError` field is set with the reason. `hasChildren` and `childrenCount` are sourced from the task itself, not the built list — so a subtask-load failure surfaces as `children: []` plus a `childrenError` (shown on the `Has Children` line) without misreporting a task that has children as childless.

---

## v1.30.14 Fix forecast date grouping and display for all timezones (#114)

**`get_forecast_tasks` now groups tasks under the correct local date for UTC+ users.**
`getDateKey` in `forecastTasks.js` previously called `toISOString()` after zeroing the time, which converts back to UTC — in a UTC+10 environment, local midnight April 28 became the key `"2026-04-27"`, placing tasks under the wrong day. The key is now built directly from local year/month/date components.

**`formatDateSafe` now displays the correct date for bare `YYYY-MM-DD` strings in UTC- timezones.**
`new Date("2026-04-28")` is parsed as UTC midnight, which `toLocaleDateString()` then renders as April 27 for UTC-X users. Bare date strings are now constructed with the local-time form `new Date(year, month, day)` to keep the displayed date accurate.

**`formatDateSafe` rejects malformed bare dates instead of silently rolling them forward.**
The local-time constructor `new Date(year, month, day)` rolls overflow forward (e.g. `2026-13-45` → February 2027), so an invalid-but-well-shaped string would render as a bogus date. A round-trip check now returns `null` for these, matching the prior `new Date("2026-13-45")` behaviour.

---

## v1.30.13 Reject non-positive / non-integer `newReviewInterval` in `edit_item` (Issue #124)

**`edit_item(itemType: "project", newReviewInterval: 0)` no longer reports a fake success.** Previously, passing `0` (or any other value that OmniFocus silently refused, e.g. negative numbers or fractional values) would return `✅ Project "<name>" updated successfully (review interval).` while the project's interval, next-review date, and last-reviewed date remained byte-identical — the response said the call had taken effect when it hadn't. The misleading success made failed clear-attempts indistinguishable from real updates.

The Zod schema for `newReviewInterval` is now constrained to **positive integers** (`.int().positive()`). `0`, negatives like `-5`, and non-integers like `1.5` are rejected at the MCP boundary with `"newReviewInterval must be a positive integer"`, before the `editItem` handler runs. Legitimate positive integers continue to work unchanged.

**Surface change for callers.** The rejection surfaces as an MCP `InvalidParams` protocol error (in Claude, typically an "Error calling tool" red-flag), *not* as a tool result with `isError: true` and *not* as a `{ success: false, error: "…" }` shape from the underlying script. The substring `"newReviewInterval must be a positive integer"` appears inside the JSON-stringified Zod issues array. Callers that previously branched on the tool-result success field will now hit the protocol-error path instead — which is the correct outcome (these values were never valid).

**Reachability.** The fix closes the gap surfaced by the [v1.30.12 reachability note](#v1.30.12-surface-review-interval-template-lookup-error-in-edit_item-issue-110-phase-4-closes-110): the no-interval state remains unconstructible from the MCP today (`add_project` still auto-assigns a 7-day default; OmniFocus appears to require every project to have an interval), but the misleading-success path that hid that fact is now gone. The Phase 4 `templateError` plumbing in `editItem.js` is unchanged.

**Forward-compat note.** `batch_edit_items` does not currently expose `newReviewInterval`. If review-interval support is ever added to the batch tool, the same `.int().positive()` constraint should travel with it so the two entry points agree.

**Impact.** No change to legitimate review-interval updates. Calls that pass `0`, negative integers, or fractional values — previously silent-success or undefined-behaviour — now produce a clear validation error.

---

## v1.30.12 Surface review-interval template-lookup error in edit_item (Issue #110, Phase 4 — closes #110)

**`edit_item`'s "Cannot set review interval" error is no longer silently misleading.** When `edit_item` is called with `newReviewInterval` on a project that has no existing interval, the script tries to copy a template from any other project that does. Previously, if that template-search loop threw (e.g. a Bridge proxy hiccup mid-iteration), the error was swallowed by an empty `} catch (e) {}` and the user only saw the generic "Cannot set review interval - project has no existing interval to modify" — even when other projects with intervals existed.

The error message now appends the underlying cause when the template lookup actually failed, e.g.: `Cannot set review interval - project has no existing interval to modify (template lookup failed: <reason>)`. When the lookup runs cleanly and just finds no candidate (the normal "no project has any review interval set" case), the message is unchanged.

**Impact:** Identical to before on every existing success path. On error paths where the template search threw, the user now sees the real cause. No new tools, no schema changes, no TS-layer changes — the improved error string flows through the existing `parsed.error` path.

**Reachability note.** On a normal MCP-managed database this code path is **not currently reachable**: the precondition (a project with no review interval) can't be constructed via the MCP — `add_project` auto-assigns a default interval and `edit_item newReviewInterval: 0` silently no-ops (tracked as #124). The fix is therefore **defensive** — it removes the silent catch and surfaces the cause if the path ever does fire (e.g. a database modified outside the MCP, or once #124 resolves in a way that opens the no-interval state to MCP callers). No observable MCP change on a healthy DB today; the smoke test plan accordingly marks TC3 / TC4 as n/a.

**Pattern note.** This catch sits inside an error-return path (when the template loop throws, `reviewInterval` stays null and `edit_item` always errors out), so the Phase 2/3 success-JSON `processingErrors` warning pattern would have been architecturally dead code here. Propagating the cause into the error message is the honest equivalent — same goal (don't silently swallow), different vehicle (the error string instead of a warning section).

**Closes #110.** This is the final phase. Phase 1 (PR #120, v1.30.9) removed dead `omnifocusDump.js`; Phase 2 (PR #121, v1.30.10) instrumented `list_projects` / `get_projects_for_review`; Phase 3 (PR #122, v1.30.11) instrumented the three entity-lookup tools and fixed two parent-field guards; Phase 4 (this) closes the last catalogued silent catch.

---

## v1.30.11 Fix parent lookups + surface metadata read errors in entity-lookup tools (Issue #110, Phase 3)

**Two parent-field fixes (most user-visible).** Both were wrong-property guards that tested a sub-property which does not exist, so the guarded body never ran and the field was *always* null — invisible to error-handling because nothing ever threw:

- **`get_folder_by_id`** now populates `parentFolderName` / `parentFolderId` (and shows a `• Parent Folder:` line) when a folder is nested inside another folder. The guard previously checked a non-existent `folder.parent.folder`. Top-level folders correctly still show no parent.
- **`get_task_by_id`** now populates `parentName` / `parentId` (and shows a `• Parent Task:` line) for a **genuine subtask** (a task nested under another task). The guard previously checked a non-existent `task.parent.task`. Top-level tasks correctly still show *no* parent (their `parent` is the project's hidden root task, which is excluded via `task.parent.project`) and continue to show their `• Project:` line as before.

**Error-surfacing for the three entity-lookup tools.** `get_project_by_id`, `get_folder_by_id`, and `get_task_by_id` no longer silently swallow optional-field read errors. Previously, if a project's task count / folder / review dates, a folder's project or subfolder counts, or a task's parent / project / tags couldn't be read, the `catch` block discarded the error and the field silently fell back to `0`/`null`. These tools now count such failures and append a **⚠️ Processing Warnings** section (up to 3 sample messages) and emit a server-side `log.warn`.

**Impact:** Error-free calls produce identical output to before — the warning only appears when a field actually failed to read. The entity itself is still returned; this only adds visibility into incomplete data.

**Cache caveat (`get_task_by_id` only):** this tool caches its result, so if a lookup ever does produce a warning, the warning re-surfaces on subsequent cache hits for the same task until the cache entry expires.

**Pattern.** This reuses the `processingErrors: { metadataErrors, samples }` contract from v1.30.10 (Phase 2), rendered by the shared `formatProcessingWarnings()`. The shared `ProcessingErrors` type now lives in `src/utils/formatUtils.ts`. Defensive folder-traversal guards that return a safe default (`getEffectiveStatus`) remain intentionally uncounted. Remaining: Phase 4 = `editItem.js`.

---

## v1.30.10 Surface metadata read errors in project listing tools (Issue #110, Phase 2)

**`list_projects` and `get_projects_for_review` no longer silently swallow optional-field read errors.** Previously, if a project's task count, folder info, or review date/interval couldn't be read, the `catch` block discarded the error and the field silently fell back to `0`/`null` — so a partial result was indistinguishable from a complete one. These tools now count such failures and append a **⚠️ Processing Warnings** section (e.g. "2 details could not be read; affected fields may show as '-', 0, or null") with up to 3 sample messages, and emit a server-side `log.warn`.

**Impact:** Error-free calls produce identical output to before — the warning only appears when a field actually failed to read. The projects themselves are still listed; this only adds visibility into incomplete data.

**Also fixed (`get_projects_for_review`):** each project now correctly shows its **folder**. The script was reading a non-existent `project.folder` property (always `undefined`) instead of `project.parentFolder`, so the folder line was silently always blank. This was a wrong-property bug, not a swallowed exception, so it was invisible to the error-surfacing above — found during Phase 2 testing. `list_projects` was never affected (it already used `parentFolder`).

**Pattern.** This reuses the `processingErrors` mechanism from v1.30.7 (issue #104/#109), generalized with a new `metadataErrors` category in `formatProcessingWarnings()`. The `processingErrors: { metadataErrors, samples }` contract is the template for the remaining #110 phases (`getProjectByName.js`, `getFolderByName.js`, `getTaskByIdOrName.js`, `editItem.js`). Defensive folder-traversal guards that return a safe default (`isInDroppedFolder`/`isEffectivelyDropped`) are intentionally left uncounted.

---

## v1.30.9 Remove dead dump_database code (Issue #110)

**Removed orphaned remnants of the old `dump_database` feature.** The `dump_database` tool itself was removed long ago, but three files were left behind as dead code that nothing referenced:
- `src/utils/omnifocusScripts/omnifocusDump.js` — the OmniJS export script (no tool executed it)
- `src/types.ts` — the dump's data-model interfaces (`OmnifocusTask`, `OmnifocusDatabase`, etc.; zero imports, not a published type surface)
- `src/omnifocustypes.ts` — unused `Minimal` types

Also corrected a stale hint in the `list_projects` tool description that referenced the non-existent `dump_database` tool.

**Impact:** None for users — no tool behavior changes. This is pure dead-code removal.

**Relation to issue #110.** #110 catalogues silent `catch` blocks across OmniJS scripts. The `omnifocusDump.js` cases it lists were in this dead script, so they are resolved by deletion rather than by adding error reporting. The remaining live scripts named in #110 (`listProjects.js`, `getProjectsForReview.js`, `getProjectByName.js`, `getFolderByName.js`, `getTaskByIdOrName.js`, `editItem.js`) are tracked as follow-up work.

---

## v1.30.8 Fix add_project folderName case sensitivity (Issue #112)

**`add_project` folder name lookup is now case-insensitive.** Previously `add_project` required an exact-case match on `folderName`, while `batch_add_items` and `edit_item` already matched case-insensitively. All three tools now behave consistently — e.g. `folderName: "work projects"` resolves to an existing `Work Projects` folder.

**Note on issue #112 scope.** The issue also reported two other defects: (1) `batch_add_items` with `folderName` + `sequential: true` flipping projects to Dropped; (2) `edit_item` / `batch_edit_items` with `newProjectStatus: "active"` failing to recover Dropped projects. Neither could be reproduced in diagnostic testing against v1.30.7 across multiple variants (including a sequential project with child tasks, and drop-then-recover via both `edit_item` and `batch_edit_items`). The cited source code is unchanged; applying speculative fixes without a reproducer was deliberately avoided. Those reports remain open on #112 pending fresh steps-to-reproduce.

---

## v1.30.7 Surface silent catch block errors in filter operations (Issues #104, #109)

**Improved error visibility in `filter_tasks` and `batch_filter_tasks`:**
- Per-task filter errors are now counted and reported instead of silently excluding tasks
- Task serialization errors are now counted and reported instead of silently dropping tasks
- Project-level errors in batch operations now produce a result entry with error details instead of silently skipping the project
- `countOnly` mode now includes `processingErrors` in its response when filter evaluation errors occur
- Warning section displayed in output when any tasks were excluded due to processing errors
- Up to 3 sample error messages captured for troubleshooting (with reliable `error.message` coercion)
- Server-side `log.warn` emitted when processing errors are present
- Shared `formatProcessingWarnings()` utility in `src/utils/formatUtils.ts` for consistent warning display

**Impact:** Error-free operations produce identical output to before. Warnings only appear when errors actually occur.

---

## v1.30.6 Bring batch_filter_tasks to date filter parity (Issue #103)

**`batch_filter_tasks` now supports the same date filters as `filter_tasks`:**
- Added 16 date filter parameters across due, defer, planned, and completion date categories
- Added `isThisMonth()` helper for month-based comparisons
- Added `wantsCompletedTasks` logic so completion date filters correctly include completed tasks
- All range filters (`*Before`, `*After`) use the early-return null-check pattern from v1.30.5
- Added `plannedDate` and `completedDate` to task output and sort options
- Updated Zod schema and TypeScript interface for full type safety

**Intentionally excluded** from batch (project-scoped by design): `searchText`, tag filters, estimate filters, `inInbox`, `countOnly`, `perspective`.

---

## v1.30.5 Implement missing date filters and fix null-check bug (PR #101)

**13 date filters in `filter_tasks` now work correctly:**
- Implemented 11 date filters that were defined in the tool schema but never wired up in the OmniJS script:
  - **Due date**: `dueToday`, `dueThisWeek`, `dueThisMonth`, `dueBefore`, `dueAfter`, `overdue`
  - **Defer date**: `deferToday`, `deferThisWeek`, `deferBefore`, `deferAfter`, `deferAvailable`
- Fixed `completedThisWeek` and `completedThisMonth` filters that were parsed but never applied — previously these returned all completed tasks instead of filtering by date range
- Fixed null-check bug in `plannedBefore`, `plannedAfter`, `completedBefore`, and `completedAfter` filters — tasks with null dates were incorrectly included in results due to JavaScript short-circuit evaluation
- Added `isThisMonth()` helper function for month-based date comparisons

*Contributed by @vesan*

---

## v1.30.4 Surface Focus restore errors (Issue #99)

**Focus mode restore failures are now reported instead of silently swallowed:**
- Refactored OmniJS script to use a result variable, allowing the `finally` block to append error info
- If restoring Focus mode fails, `focus.restoreError` is included in the JSON response
- The TypeScript layer now displays a warning when Focus restore fails
- Primary operation results are preserved — restore errors are additive, not overriding

---

## v1.30.3 Fix get_custom_perspective_tasks TypeError (Issue #97)

**Fixed `get_custom_perspective_tasks` crashing when no Focus mode is active:**
- `document.focus` returns `undefined` (not `null`) when no Focus is set in OmniFocus
- The strict equality check (`!== null`) didn't catch `undefined`, causing a TypeError on property access
- Changed to loose equality (`!= null`) which correctly handles both `null` and `undefined`

---

## v1.30.2 Fix get_custom_perspective_tasks SyntaxError (Issue #95)

**Fixed `get_custom_perspective_tasks` failing with duplicate variable declaration error:**
- The script declared `perspectiveName` and `perspectiveId` variables that conflicted with runtime injection
- Removed duplicate declarations - these variables are now correctly provided by `scriptExecution.ts`
- Added documentation comment explaining the runtime injection pattern

---

## v1.30.1 Type-Safe Error Handling (Issue #86)

**Internal improvement: Standardized error handling with type guards**

- Replaced `catch (error: any)` patterns with type-safe `catch (error)` using proper type guards
- Added `isExecException` type guard for Node.js `ExecException` properties (`killed`, `signal`, `stderr`)
- Updated `categorizeError` to accept `unknown` instead of `any`
- No functional changes - this is a TypeScript strictness improvement

---

## v1.30.0 Focus Mode Handling for Custom Perspectives (Issue #68)

**New Feature: Focus Mode Awareness**

When OmniFocus Focus mode is active, perspective queries normally return only focused items. AI assistants had no visibility into this, thinking they were seeing the full picture when actually getting filtered data.

**Solution:**
- Added `ignoreFocus` parameter to `get_custom_perspective_tasks` (default: `true`)
- When `true` (default): Clears Focus mode temporarily to return all tasks
- When `false`: Respects Focus mode, returns only focused tasks
- Response includes Focus metadata showing when Focus was active

**Output example when Focus was active:**
```
**Perspective Tasks: Dashboard** (47 tasks)
> Focus mode was active on "Work Projects" - temporarily cleared for complete results

1. **Task Name** [ID: abc123]
   ...
```

**Usage:**
```json
// Get all tasks (ignores Focus mode - default)
{"perspectiveName": "Dashboard"}

// Respect Focus mode
{"perspectiveName": "Dashboard", "ignoreFocus": false}
```

---

## v1.29.7 Fix batch_edit_items newFolderId Support (Issue #90)

**Fixed `batch_edit_items` silently ignoring `newFolderId` parameter:**
- Previously, using `newFolderId` to move projects was silently ignored
- Now correctly moves projects to the specified folder by ID
- ID lookup takes priority over name lookup (matches `edit_item` behavior)

**Behavior note:**
- `newFolderId` not found → Error (folders aren't auto-created by ID)
- `newFolderName` not found → Creates new folder (existing behavior preserved)

**Example:**
```json
{
  "edits": [
    {"itemType": "project", "id": "proj123", "newFolderId": "folder456"}
  ]
}
```

---

## v1.29.6 Fix batch_edit_items newProjectId Support (Issue #88)

**Fixed `batch_edit_items` silently ignoring `newProjectId` parameter:**
- Previously, using `newProjectId` to move tasks reported "success" with "no changes"
- Now correctly moves tasks to the specified project by ID
- ID lookup takes priority over name lookup (matches `edit_item` behavior)

**Impact:**
- Inbox tasks can now be batch-moved to projects using project ID
- Common workflow: triage inbox by moving old tasks to an archive project

**Example:**
```json
{
  "edits": [
    {"itemType": "task", "id": "abc123", "newProjectId": "xyz789"},
    {"itemType": "task", "id": "def456", "newProjectId": "xyz789"}
  ]
}
```

---

## v1.29.5 Error Handling and Logging Improvements

**Fixed silent failure in script path resolution:**
- Previously, if no script path was found, the code silently fell back to an unchecked path
- Now throws an informative error listing all attempted paths with troubleshooting guidance
- Error message includes actionable steps: run build commands, check script files exist

**Added debug logging for script path resolution:**
- Each path resolution now logs the selected path and build type (esbuild, tsc, dev, absolute)
- Makes debugging build/path issues much easier

**Restored `dev` script to watch mode:**
- `npm run dev` now runs `tsc -w` again (continuous compilation)
- Previous change to `ts-node` was a behavioral regression

---

## v1.29.4 Build System Improvements

**Added `npm run build:fast` alternative build option:**
- Uses esbuild instead of tsc for ~14ms builds (vs minutes with tsc)
- Useful when tsc hangs or runs out of memory on some systems
- Produces identical working output to `npm run build`

**Fixed script path resolution for bundled builds:**
- OmniJS script files now resolve correctly when using esbuild bundled output
- Added `bundledPath` check in `scriptExecution.ts` for `dist/server.js` location
- Supports both tsc (separate files) and esbuild (single bundle) build outputs

**Why this matters:**
- Some systems experience tsc hangs due to complex type inference in `@modelcontextprotocol/sdk` and `zod`
- The `build:fast` script provides a reliable alternative that skips type checking
- For type validation, run `npx tsc --noEmit` separately or rely on IDE integration

---

## v1.29.3 Complete Logging Standardization (Issue #84)

**Extended structured logging to ALL remaining files:**

### Primitive files (11 files)
- Standardized `catch (error: any)` to `catch (error)` with `instanceof Error` pattern
- Files: `addOmniFocusTask.ts`, `addProject.ts`, `addFolder.ts`, `getTaskById.ts`, `removeItem.ts`, `editItem.ts`, `batchAddItems.ts`, `batchEditItems.ts`, `batchRemoveItems.ts`, `batchMarkReviewed.ts`, `diagnoseConnection.ts`

### perspectiveEngine.ts
- Migrated all TypeScript-level console statements to structured logger
- JXA script console statements (which run inside OmniFocus) left unchanged
- Added `logger.child('perspectiveEngine')` with consistent debug/error patterns

### Definition files (11 files)
- Added logger imports and replaced `console.error` with `log.error`
- Files: `getFolderById.ts`, `addFolder.ts`, `getProjectsForReview.ts`, `batchMarkReviewed.ts`, `batchRemoveItems.ts`, `removeItem.ts`, `getTaskById.ts`, `getProjectById.ts`, `editItem.ts`, `batchEditItems.ts`, `getPerspectiveTasksV2.ts`

**Result:** No more `console.log` or `console.error` in TypeScript code (except JXA scripts). All logging goes through structured logger to stderr.

---

## v1.29.2 Logging Standardization

**Structured logging now consistent across all primitive files (Issue #82):**
- All 10 remaining primitive files migrated from `console.error` to structured `logger` utility
- Debug output uses `log.debug()`, error handling uses `log.error()`
- Each primitive has a descriptive logger child name (e.g., `of-mcp:getFolderById`)
- Logs are written to stderr with timestamps and structured context objects

**Files updated:**
- `batchFilterTasks.ts`, `getCustomPerspectiveTasks.ts`, `getFolderById.ts`
- `getPerspectiveTasksV2.ts`, `getProjectById.ts`, `getProjectsForReview.ts`
- `getTodayCompletedTasks.ts`, `listCustomPerspectives.ts`, `listProjects.ts`, `listTags.ts`

**Benefits:**
- Consistent log format across all modules for easier debugging
- Log level filtering via `LOG_LEVEL` environment variable (debug, info, warn, error, silent)
- Structured context objects instead of string concatenation

---

## v1.29.1 Safe Date Formatting Extended

**`formatDateSafe()` now applied across all task-returning primitives (Issue #81):**
- Extended safe date handling from 4 definition files to all 8 primitive files
- 21 instances of date formatting now use `formatDateSafe()` instead of raw `new Date().toLocaleDateString()`
- Prevents "Invalid Date" strings from appearing in output when OmniFocus returns malformed dates

**Affected files:**
- `filterTasks.ts` (5 instances: createdDate, dueDate, deferDate, plannedDate, completedDate)
- `getCustomPerspectiveTasks.ts` (4 instances: dueDate x2, createdDate x2)
- `batchFilterTasks.ts` (3 instances: createdDate, dueDate, deferDate)
- `getFlaggedTasks.ts` (3 instances: dueDate, deferDate, createdDate)
- `getTasksByTag.ts` (3 instances: dueDate, deferDate, createdDate)
- `searchTasks.ts` (2 instances: dueDate, createdDate)
- `getInboxTasks.ts` (2 instances: dueDate, createdDate)
- `getForecastTasks.ts` (1 instance: createdDate)

---

## v1.29.0 Error Handling Improvements

**Improved error visibility and debugging:**
- Unexpected OmniFocus result formats now log diagnostic details before throwing (Issue #64)
- 7 primitive functions updated to log `resultType` and `result` for debugging
- Silent returns replaced with explicit errors for fail-fast behavior

**Safe date formatting utility:**
- New `formatDateSafe()` utility handles invalid dates gracefully
- Returns `null` instead of "Invalid Date" for malformed date strings
- Applied to `get_task_by_id`, `add_omnifocus_task`, `add_project`, `list_projects`

**Code consistency:**
- Standardized unused parameter naming (`_extra`) across 23 handler functions
- Follows TypeScript convention for intentionally unused parameters

---

## v1.28.3 Enhancement

**`createdDate` now displayed in formatted task output:**
- All task-returning tools now show creation date in human-readable format (e.g., `1/15/2026`)
- Uses `toLocaleDateString()` for consistent formatting across all tools
- The `createdDate` data field was added in v1.28.0; this update makes it visible in output

**Affected tools:**
- `filter_tasks`, `search_tasks`, `get_task_by_id`
- `get_inbox_tasks`, `get_flagged_tasks`, `get_forecast_tasks`
- `get_tasks_by_tag`, `batch_filter_tasks`, `get_custom_perspective_tasks`

---

## v1.28.0 New Feature

**Added `createdDate` field to task data:**
- All task-returning tools now include `createdDate` (ISO string or null)
- Exposes when tasks were originally created in OmniFocus via `task.added` property
- Use cases: sorting/filtering by task age, backlog analysis, task creation analytics

**Affected tools:**
- `filter_tasks`, `search_tasks`, `get_task_by_id`
- `get_inbox_tasks`, `get_flagged_tasks`, `get_forecast_tasks`
- `get_tasks_by_tag`, `get_today_completed_tasks`
- `batch_filter_tasks`, `get_custom_perspective_tasks`

---

## v1.27.4 Bug Fixes

**Fixed `get_system_health` untagged and flagged counts:**
- Untagged/flagged counts now exclude project root tasks (project titles)
- Now uses same active status filter as inbox count (Available, DueSoon, Next, Overdue)
- Consistent with OF Statistics plug-in behavior

---

## v1.27.3 Bug Fixes

**Fixed `get_system_health` inbox count to match OmniFocus UI:**
- Previously counted all inbox tasks including completed/dropped/blocked (143 vs actual 18)
- Now counts only active inbox tasks (Available, DueSoon, Next, Overdue) to match OF Statistics behavior
- Inbox count now matches OF Statistics plug-in and the OmniFocus UI

**Added completed tasks count to `get_system_health` output:**
- The Tasks section now includes total completed tasks count
- This matches the historical metric tracked by OF Statistics plug-in

---

## v1.27.2 Bug Fixes

**Fixed `get_system_health` crashing with "inbox.tasks.length" error:**
- The `inbox.tasks` property is not reliably available when running OmniJS via `evaluateJavascript()`
- Changed to use `flattenedTasks.filter(task => task.inInbox)` which is the pattern used by all other scripts
- This fixes the weekly review skill and any workflow using `get_system_health`

---

## v1.27.1 Bug Fixes

**IDs now included in add/create responses:**
- `add_omnifocus_task` now returns `(id: xyz123)` in the success message
- `add_project` now returns `(id: xyz123)` in the success message
- `batch_add_items` now returns `(id: xyz123)` for each created item

This allows AI assistants to immediately reference created items without additional lookups.

**search_tasks result count safeguard:**
- Searches without `projectName` or `projectId` that match >500 tasks now return guidance to narrow the search
- Specific searches on large databases work fine - only broad queries with many matches are affected
- Provides actionable suggestions (add project filter, use specific terms, try different match modes)

---

## Efficiency Guidelines (IMPORTANT)

**Always prefer batch operations over individual calls:**

| Instead of... | Use... | Benefit |
|---------------|--------|---------|
| Multiple `add_omnifocus_task` calls | `batch_add_items` | 9x faster |
| Multiple `edit_item` calls | `batch_edit_items` | 12x faster |
| Multiple `remove_item` calls | `batch_remove_items` | 9x faster |
| Multiple `filter_tasks` calls for different projects | `batch_filter_tasks` | Single API call |

**Caching**: Repeated read queries (`filter_tasks`, `search_tasks`, `get_task_by_id`) are now cached. The cache auto-invalidates when you make changes.

---

## New Tools

### Sprint 10: AI Assistant Optimizations
| Tool | Description |
|------|-------------|
| `get_system_health` | Get all OmniFocus health metrics in ONE call. Returns inbox, projects, tasks, tags, flagged, and untagged counts with health indicators (🟢/🟡/🔴). Replaces 6+ separate API calls. |
| `get_completion_stats` | Get task completion counts grouped by project, tag, or folder for a date range. Returns sorted list with percentages. Replaces N filter_tasks calls. |

### Sprint 10: filter_tasks Enhancement
| Parameter | Description |
|-----------|-------------|
| `countOnly: true` | Return only the count of matching tasks, not task data. Much faster for health checks and dashboards. |

### Sprint 8: New Tools
| Tool | Description |
|------|-------------|
| `search_tasks` | Full-text search across task names and notes. Simpler than filter_tasks for text searches. Supports: contains, anyWord, allWords, exact match modes. |
| `duplicate_project` | Copy a project with all tasks. Great for templates. Supports date shifting, hierarchy preservation. |
| `edit_tag` | Change tag status (active/onHold/dropped), rename, move to different parent. Use to reactivate dropped tags. |

### Sprint 4: Diagnostics
| Tool | Description |
|------|-------------|
| `diagnose_connection` | Check OmniFocus connectivity and permissions. Run this first if experiencing issues. |

---

## Performance Improvements

### Query Caching (Sprint 7)
- `filter_tasks`, `search_tasks`, `get_task_by_id` results are cached
- Cache validates via database checksum (task count + modification time)
- Repeated identical queries return instantly (<100ms vs 3-4s)
- Cache auto-invalidates on any write operation

### Retry with Backoff (Sprint 5)
- Transient OmniFocus errors automatically retry (up to 3 attempts)
- Exponential backoff prevents overwhelming OmniFocus

---

## Reliability Improvements

### Error Handling (Sprints 1, 5)
- Errors now propagate with clear messages instead of being swallowed
- Execution timeout prevents hung operations (30s default)
- Consolidated error handling across all tools

### Cycle Detection (Sprint 6)
- Batch operations detect circular parent references
- Prevents infinite loops when creating task hierarchies

---

## Enhanced Capabilities

### list_tags Enhancement
- Now shows tag status: active, (on hold), (dropped)
- Use `edit_tag` to reactivate dropped tags

### Sprint 9B: get_tasks_by_tag Enhancement
- **New parameter**: `includeDropped: true` to search tasks by dropped/inactive tags
- Default behavior unchanged (only searches active tags)
- Use case: Find tasks blocked by tags that were later dropped

### Sprint 9C: filter_tasks Enhancement
- **New parameter**: `untagged: true` to filter for tasks with NO tags assigned
- Use case: Find unorganized tasks after bulk tag removal
- Example: `filter_tasks {"untagged": true, "taskStatus": ["Available"]}`

---

## Bug Fixes

### Sprint 9A: Project Tag Operations
- **Fixed**: Tag operations (`addTags`, `removeTags`, `replaceTags`) now work on **both tasks and projects**
- Previously, using `itemType: "project"` with tag operations would silently succeed without making changes
- Now you can properly add/remove tags from projects using `edit_item` and `batch_edit_items`

---

## Tool Count

**Total: 31 tools**

| Category | Tools |
|----------|-------|
| Task CRUD | add_omnifocus_task, edit_item, remove_item |
| Batch Operations | batch_add_items, batch_edit_items, batch_remove_items |
| Queries | filter_tasks, batch_filter_tasks, search_tasks, get_task_by_id |
| Perspectives | get_inbox_tasks, get_flagged_tasks, get_forecast_tasks, get_tasks_by_tag, get_custom_perspective_tasks, list_custom_perspectives |
| Projects/Folders | add_project, add_folder, list_projects, get_project_by_id, get_folder_by_id, duplicate_project |
| Analytics | get_system_health, get_completion_stats |
| Tags | list_tags, edit_tag |
| Review | get_projects_for_review, batch_mark_reviewed |
| Utility | get_server_version, diagnose_connection, get_today_completed_tasks |

---

## Best Practices Summary

1. **Use batch tools** for 2+ operations (9-12x faster)
2. **Let caching work** - don't worry about repeated reads
3. **Use `search_tasks`** for simple text searches instead of `filter_tasks`
4. **Use `batch_filter_tasks`** when querying multiple projects
5. **Check `diagnose_connection`** first if operations fail
6. **Use IDs over names** when available (more reliable)
