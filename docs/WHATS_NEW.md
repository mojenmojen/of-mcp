# OmniFocus MCP Server - What's New (v1.29.7)

> Summary of changes from Sprints 1-10 for AI assistants using this MCP server.

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
