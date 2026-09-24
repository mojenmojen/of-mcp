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
# (esbuild-transpiles the pure date utils, then runs node:test; no full tsc
#  build or OmniFocus needed — esbuild is used because the full tsc build is
#  known to hang/OOM on some systems, see build:fast)
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

**Retry policy** (`src/utils/retryPolicy.ts`): killing the `osascript` subprocess does not cancel the script running inside OmniFocus, so retrying a timed-out write lands it again — one `add_folder` call once produced four folders (#154). Two separate questions decide what happens after a timeout, and conflating them is a bug: `isRetrySafeScript()` asks whether the script may be run again, `mayHaveWritten()` asks whether it could have changed anything. A read can answer no to the first (`diagnoseConnection`, `getCustomPerspectiveTasks`) without being a write, and must not be described to the user as a change that may have landed.

**Add every new OmniJS script to `READ_SCRIPTS` or `WRITE_SCRIPTS`**, and never make a write retryable on timeout. An unclassified script is treated as unsafe to repeat and as having possibly written, which fails in the harmless direction. `tests/retryPolicy.test.mjs` fails if a script file is left unclassified, if an entry has no file, or if anything in the retry-safe set contains a mutation call.

**Subtask Support**: Enhanced with hierarchical task relationships using `parentTaskName` or `parentTaskId` parameters.

**Testing**: `npm test` runs the automated suite, which needs no OmniFocus: unit tests for the pure TypeScript utilities and for `lib/sharedUtils.js`, and script-level tests that run the OmniJS scripts in `node:vm` with stand-in OmniFocus globals (shared harness: `tests/helpers/omnijsHarness.mjs`). Live OmniFocus behaviour still needs the manual `tests/test-*.mjs` runs.

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
- `resolveFolderRef(folderName, allFolders)` - Resolve a folder by name or "Parent > Child" path; returns `{ folder, matches, ambiguous }` so callers can fail closed on duplicates
- `formatAmbiguousFolderError(folderName, matches, idParam)` - The one error message for an ambiguous folder name; `idParam` is the calling tool's folder-ID parameter
- `getFolderPath(folder)` - A folder's full "Parent > Child" path; throws if the parent chain can't be read

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