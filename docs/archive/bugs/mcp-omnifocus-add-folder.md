# Feature Request: Add Folder Support to mcp-omnifocus

## Summary
Add ability to create folders in OmniFocus via the MCP server.

## Current State
The mcp-omnifocus server supports:
- `add_project` - Create projects (can specify `folderName` to place in existing folder)
- `add_omnifocus_task` - Create tasks
- `edit_item` - Edit tasks/projects (can move projects via `newFolderName`)

**Missing:** No way to create new folders.

## Proposed API

### `add_folder`
Create a new folder in OmniFocus.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Name of the folder to create |
| parentFolderName | string | No | Parent folder name (creates nested folder). If omitted, creates at root level. |
| parentFolderId | string | No | Parent folder ID (alternative to parentFolderName) |

**Returns:**
- Folder ID
- Folder name
- Parent folder (if nested)
- Success confirmation

**Example usage:**
```json
{
  "name": "activities",
  "parentFolderName": "someday/maybe"
}
```

**Result:**
```
✅ Folder "activities" created successfully inside "someday/maybe"
Folder ID: abc123xyz
```

## Use Case
During OmniFocus audit, identified need to reorganize someday/maybe folder:
- Current: All projects (activities + project ideas) mixed together
- Desired: Separate `activities` subfolder for leisure/menu-style projects

Without folder creation, user must manually create folder in OmniFocus app, then return to automation to move projects.

## Implementation Notes
OmniFocus automation (JXA/AppleScript) supports folder creation:
```javascript
// JXA example
const of = Application('OmniFocus');
const doc = of.defaultDocument;
const parentFolder = doc.folders.byName('someday/maybe');
const newFolder = of.Folder({name: 'activities'});
parentFolder.folders.push(newFolder);
```

## Priority
Medium - Workflow improvement, not blocking critical functionality.

## Requested by
Seshat (MoJen's productivity assistant) during omnifocus-audit skill testing.

## Date
2026-01-06
