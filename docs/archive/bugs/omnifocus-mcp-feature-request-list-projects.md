# Feature Request: List Projects in Folder

**Date**: 2026-01-05
**MCP Server**: mcp-omnifocus
**Priority**: High (blocks common workflows)

## Problem

There is no way to list projects within a specific folder without using `dump_database`.

### Current Tools

| Tool | What it does | Limitation |
|------|--------------|------------|
| `get_folder_by_id` | Returns folder info including project count | Does NOT list project names/IDs |
| `get_project_by_id` | Returns single project details | Requires knowing project name/ID already |
| `filter_tasks` | Filters tasks by various criteria | Filters tasks, not projects |
| `get_projects_for_review` | Returns projects due for review | Only returns subset due for review |
| `dump_database` | Returns everything | Expensive, times out on large databases |

### The Gap

`get_folder_by_id` returns:
```
📂 **Folder Information**
• **Name**: projects
• **ID**: aE82mg1mdKA
• **Status**: Active
• **Projects**: 10 active (11 total)  ← knows there are 10, but won't list them
• **Subfolders**: 0
```

No way to get those 10 project names/IDs without `dump_database`.

## Use Cases Blocked

1. **Project review by folder** - "Show me all projects in my Projects folder for review"
2. **Bulk operations** - "Set review date to today for all projects in this folder"
3. **Folder audits** - "What projects are in Someday/Maybe?"
4. **Reorganization** - "List projects in Areas so I can decide what to move"

## Proposed Solution

### Option A: New `list_projects` Tool

```javascript
mcp__mcp-omnifocus__list_projects({
  folderName: "Projects",      // optional - filter by folder
  folderId: "aE82mg1mdKA",     // optional - filter by folder ID
  status: "active",            // optional - active, onHold, completed, dropped
  includeTaskCount: true,      // optional - include task counts
  limit: 100                   // optional - max results
})
```

Returns:
```
# Projects in "Projects" folder

| Name | ID | Status | Tasks | Review Due |
|------|-----|--------|-------|------------|
| Project A | abc123 | Active | 5 | 2026-01-10 |
| Project B | def456 | Active | 12 | 2026-01-05 |
| Project C | ghi789 | On Hold | 0 | 2026-02-01 |
```

### Option B: Enhance `get_folder_by_id`

Add a `includeProjects: true` parameter that lists all projects in the folder response.

### Option C: Add `folderFilter` to Existing Tool

Add folder filtering to `get_projects_for_review`:
```javascript
mcp__mcp-omnifocus__get_projects_for_review({
  folderName: "Projects",     // NEW - filter by folder
  includeOnHold: true,
  includeNotDue: true,        // NEW - return all projects, not just due ones
  limit: 100
})
```

## Recommendation

**Option A** is cleanest - a dedicated `list_projects` tool mirrors the existing `list_custom_perspectives` pattern and provides clear, focused functionality.

## Workaround (Current)

Only option is `dump_database` which:
- Times out on large databases
- Returns far more data than needed
- Violates the "use targeted tools" principle documented in CLAUDE.md

## Impact

Without this feature, folder-based project workflows require either:
1. User manually providing project names
2. Using expensive `dump_database` calls
3. Skipping folder-based operations entirely
