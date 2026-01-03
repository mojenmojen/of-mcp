# OmniFocus MCP Inbox Task Creation Bug

## Summary

Creating tasks without specifying a `projectName` fails in OmniFocus MCP v1.8.3. The server incorrectly passes the Inbox object as a position parameter to the Task constructor.

## Affected Version

- **MCP Server**: `omnifocus-mcp-enhanced` v1.8.3
- **Node Version**: v23.7.0
- **Platform**: darwin (macOS)

## Error Message

```
Failed to create task: Error adding task: Error: Task constructor argument "position"
at index 1 requires a value of type Project, Task, or Task.ChildInsertionLocation,
but was given a value of type Inbox
```

## Reproduction Steps

1. Call `add_omnifocus_task` without a `projectName`:
```json
{
  "name": "Test task",
  "deferDate": "2026-01-03T09:00:00",
  "dueDate": "2026-01-03T10:00:00"
}
```

2. Same error occurs with `batch_add_items`:
```json
{
  "items": [{
    "type": "task",
    "name": "Test task",
    "deferDate": "2026-01-03T09:00:00",
    "dueDate": "2026-01-03T10:00:00"
  }]
}
```

## Root Cause (Suspected)

The OmniFocus JavaScript API's `Task` constructor accepts these position types:
- `Project`
- `Task` (for subtasks)
- `Task.ChildInsertionLocation`

The `Inbox` object is **not** a valid position type. The MCP server code likely does something like:

```javascript
// Broken - Inbox is not a valid position
new Task(name, inbox)

// Should be - add to inbox differently
inbox.add(new Task(name))
// or
new Task(name, inbox.beginning)  // if Inbox supports ChildInsertionLocation
```

## Workaround

Always specify a `projectName` when creating tasks:

```json
{
  "name": "Test task",
  "projectName": "My Project",
  "deferDate": "2026-01-03T09:00:00"
}
```

This works correctly.

## Impact

- Cannot create tasks directly to Inbox via MCP
- Affects both `add_omnifocus_task` and `batch_add_items` tools
- Skills that rely on inbox task creation will fail

## Status

- [ ] Reported to maintainer
- [ ] Fix verified

## Related

- Previous bug: Date parsing issue (fixed in v1.8.3)
- MCP repo: https://github.com/jqlts1/omnifocus-mcp-enhanced

---
*Documented: 2026-01-03*
