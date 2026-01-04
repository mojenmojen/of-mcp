# Bug Report: `parentTaskId` in `batch_add_items` Silently Fails

## Summary
When using `batch_add_items` with the `parentTaskId` parameter, the MCP server reports success but tasks are created as siblings in the parent's project rather than as children of the specified parent task.

## Environment
- **MCP Server**: mcp-omnifocus
- **OmniFocus Version**: (macOS)
- **Date**: 2026-01-04

## Steps to Reproduce

1. Create a parent task:
```json
{
  "items": [{
    "type": "task",
    "name": "morning",
    "projectName": "morning habits",
    "tags": ["routine"],
    "deferDate": "2026-01-04T03:00:00",
    "dueDate": "2026-01-04T08:00:00"
  }]
}
```

2. Get the parent task ID using `filter_tasks`:
   - Result: `f9HKN26QdZa`

3. Create child tasks using `parentTaskId`:
```json
{
  "items": [
    {"type": "task", "name": "review oura", "parentTaskId": "f9HKN26QdZa", "tags": ["routine"]},
    {"type": "task", "name": "make bed", "parentTaskId": "f9HKN26QdZa", "tags": ["routine"]}
  ]
}
```

4. Server returns:
```
✅ Successfully added 2 items.
- ✅ task: "review oura"
- ✅ task: "make bed"
```

5. Check OmniFocus - tasks exist but are **siblings** of "morning" in the project, not children.

## Expected Behavior
Tasks should be created as subtasks (children) of the specified parent task.

## Actual Behavior
- Server reports success
- Tasks are created in the same project as the parent
- Tasks are **not** nested under the parent - they appear as siblings
- No error or warning is returned

## Workaround
Use a two-phase approach:

1. **Phase 1**: Create tasks with `projectName` (no `parentTaskId`):
```json
{"type": "task", "name": "review oura", "projectName": "morning habits", "tags": ["routine"]}
```

2. **Phase 2**: Move each task using `edit_item` with `newParentTaskId`:
```json
{
  "itemType": "task",
  "id": "kLdH_-dYbxS",
  "newParentTaskId": "f9HKN26QdZa"
}
```

This works correctly - `newParentTaskId` in `edit_item` **does** create the parent-child relationship.

## Additional Notes

### `get_task_by_id` returns incorrect/malformed IDs

When retrieving a task by name immediately after creation:
```
taskName: "morning"
```

Returns:
```
ID: ggFiY-P5MP2.1157.5.82.1.121.106.789
```

This long dotted format doesn't match OmniFocus's typical ID format (e.g., `f9HKN26QdZa`). Using this malformed ID with `parentTaskId` may contribute to the silent failure.

**Reliable ID retrieval**: Use `filter_tasks` with `projectFilter` instead of `get_task_by_id` with `taskName` to get correct IDs.

## Impact
- Silent failures make debugging difficult
- Requires 2x API calls (create + move) instead of 1x
- Breaks automation workflows that rely on nested task creation

## Suggested Fix
1. Actually implement parent-child nesting when `parentTaskId` is provided
2. If nesting fails, return an error instead of silent success
3. Fix `get_task_by_id` to return correct ID format
