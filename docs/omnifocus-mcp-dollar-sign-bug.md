# OmniFocus MCP Server Bug Report: Special Character Matching Failure

## Summary
The OmniFocus MCP server (v1.8.1) cannot match task names containing `$` symbols when using `edit_item` or `get_task_by_id` operations. Tasks can be *found* via `filter_tasks` search, but cannot be *modified* because the name matching fails.

## Environment
- **MCP Server**: omnifocus-mcp-enhanced v1.8.1
- **Node Version**: v23.7.0
- **Platform**: darwin (macOS)
- **OmniFocus Version**: (current, via AppleScript/JXA)

## The Problem

### What Works
```
filter_tasks with searchText: "leticia extra"
```
**Result**: Successfully finds the task
```
Found 1 task:
pay leticia extra $400 for Xmas day and New Year's Day [DUE: 18/12/2025]
```

### What Fails

#### Attempt 1: get_task_by_id with taskName
```javascript
get_task_by_id({ taskName: "pay leticia extra $400" })
```
**Error**:
```
Failed to retrieve task: OmniFocus got an error: Can't get flattened task 1
of document 1 whose name = "pay leticia extra $400". Invalid index.
```

#### Attempt 2: edit_item with full name
```javascript
edit_item({
  itemType: "task",
  name: "pay leticia extra $400 for Xmas day and New Year's Day",
  newStatus: "completed"
})
```
**Error**: Task not found (exact error text not captured, but same root cause)

#### Attempt 3: edit_item with partial name (no $)
```javascript
edit_item({
  itemType: "task",
  name: "pay leticia extra",
  newStatus: "completed"
})
```
**Error**:
```
Task not found with name "pay leticia extra".
```
Note: Partial matching doesn't work - requires exact name match.

## Suspected Root Cause

The MCP server uses AppleScript (or JXA - JavaScript for Automation) to communicate with OmniFocus. The `$` character has special meaning in shell contexts and possibly in AppleScript string interpolation.

### Likely Location of Bug
The name matching logic that constructs an AppleScript query like:
```applescript
tell application "OmniFocus"
  set theTask to first flattened task of default document whose name = "pay leticia extra $400..."
end tell
```

The `$400` is likely being interpreted as a variable reference rather than literal text, causing the match to fail.

### Why filter_tasks Works
The `filter_tasks` operation likely uses a different code path - possibly:
1. Fetches all tasks and filters in JavaScript (not AppleScript)
2. Uses a different AppleScript query structure that handles escaping correctly
3. Uses regex/contains matching rather than exact string equality

## Affected Operations
Based on the error patterns, these operations likely fail with `$` in names:
- `get_task_by_id` (when using taskName parameter)
- `edit_item` (when using name parameter)
- Possibly `remove_item` (when using name parameter)

## Working Operations
- `filter_tasks` - search finds tasks with `$` in names
- `get_flagged_tasks` - returns tasks with `$` in names
- `dump_database` - should return all tasks including those with `$`

## Suggested Fix Approaches

### Option 1: Escape $ in AppleScript strings
Before constructing the AppleScript query, escape special characters:
```javascript
function escapeForAppleScript(str) {
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"')     // Escape quotes
    .replace(/\$/g, '\\$');   // Escape dollar signs
}
```

### Option 2: Use task ID instead of name matching
If `filter_tasks` returns task IDs (or can be modified to), the `edit_item` could use ID-based matching which avoids the string escaping issue entirely.

Check: Does the filter_tasks response include task IDs? Current output format:
```
pay leticia extra $400 for Xmas day and New Year's Day [DUE: 18/12/2025]
  admin
```
No ID visible in output - may need to add ID to response format.

### Option 3: Use JXA object references
Instead of querying by name string, maintain object references:
```javascript
// JXA approach
const of = Application('OmniFocus');
const tasks = of.defaultDocument.flattenedTasks.whose({name: {_contains: 'leticia extra'}});
// Then operate on the task object directly
```

## Test Cases for Fix Verification

1. **Basic $**: `pay leticia extra $400 for Xmas day`
2. **$ at start**: `$100 payment due`
3. **Multiple $**: `Pay $50 + $25 fees`
4. **Other special chars to test**:
   - Ampersand: `Tom & Jerry task`
   - Quotes: `Review "important" doc`
   - Backslash: `C:\path\file`
   - Parentheses: `Call John (mobile)`

## Files to Investigate

In the omnifocus-mcp-enhanced codebase, look for:
1. AppleScript/JXA execution code
2. Functions that construct `whose name =` queries
3. String escaping utilities
4. The implementation difference between `filter_tasks` and `edit_item`

## Additional Context

There's another task with the same issue:
- `Add $50 to Leticia pay for 21st Oct being Indigenous Peoples' day`

Both are in the Parent Care area and are flagged, overdue tasks that need to be marked complete.
