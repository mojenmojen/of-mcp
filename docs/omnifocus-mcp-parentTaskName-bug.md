# OmniFocus MCP Bug: `parentTaskName` Silently Fails

## Summary

When using `batch_add_items` to create child tasks with `parentTaskName`, the MCP reports success but the children are not attached to the parent task.

## Reproduction Steps

1. Create a parent task:
```json
{
  "items": [
    {
      "type": "task",
      "name": "morning",
      "projectName": "morning habits",
      "tags": ["routine"],
      "deferDate": "2026-01-03T03:00:00",
      "dueDate": "2026-01-03T08:00:00"
    }
  ]
}
```

2. Create child tasks using `parentTaskName`:
```json
{
  "items": [
    {
      "type": "task",
      "name": "review oura",
      "parentTaskName": "morning",
      "tags": ["routine"]
    },
    {
      "type": "task",
      "name": "review Stelo",
      "parentTaskName": "morning",
      "tags": ["routine"]
    }
  ]
}
```

3. MCP returns success:
```
✅ Successfully added 2 items.
- ✅ task: "review oura"
- ✅ task: "review Stelo"
```

4. Check parent task:
```
📋 **Task Information**
• **Name**: morning
• **ID**: hhajhPNRprF
• **Has Children**: No    <-- Children not attached!
```

5. Search for children - they don't exist anywhere (not in inbox, not in project)

## Expected Behavior

Child tasks should be created as subtasks of the parent task specified by `parentTaskName`.

## Actual Behavior

- MCP reports success for all items
- Parent task is created correctly
- Child tasks are **not created at all** (or created and immediately lost)
- No error is returned

## Workaround

Use `parentTaskId` instead of `parentTaskName`:

```json
{
  "items": [
    {
      "type": "task",
      "name": "review oura",
      "parentTaskId": "hhajhPNRprF",
      "tags": ["routine"]
    }
  ]
}
```

This requires:
1. Creating parent tasks first
2. Retrieving their IDs with `get_task_by_id`
3. Creating children with `parentTaskId`

## Impact

- Silent data loss - tasks appear to be created but aren't
- Requires two-phase task creation as workaround
- Skill/automation complexity increased

## Environment

- OmniFocus MCP Server v1.8.3
- macOS
- Discovered: 2026-01-03

## Possible Causes

1. Name lookup failing to find the parent task
2. Parent task not yet committed to database when children are created (race condition)
3. Name matching logic issue (case sensitivity, whitespace, etc.)
