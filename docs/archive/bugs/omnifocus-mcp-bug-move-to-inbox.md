# Bug Report: Cannot Move Project Tasks to Inbox via API

## Summary

Tasks that are already assigned to a project cannot be moved to the inbox using the `edit_item` tool's `moveToInbox` parameter. The API returns an error indicating this operation is not supported.

## Steps to Reproduce

1. Have a task that exists within a project (not in inbox)
2. Call `edit_item` with:
   ```json
   {
     "itemType": "task",
     "id": "<task-id>",
     "moveToInbox": true
   }
   ```
3. Observe the error

## Expected Behavior

The task should be removed from its current project and moved to the inbox, becoming an "unfiled" task ready for processing.

## Actual Behavior

The API returns:
```
Failed to update task: Error editing item: Error: The assignedProject property may only be set on inbox tasks.
```

## Analysis

The error message suggests the underlying JXA implementation is attempting to set `assignedProject` to achieve the inbox move, but OmniFocus only allows `assignedProject` to be set on tasks that are already in the inbox (i.e., assigning them TO a project).

The inverse operation (unassigning a task from a project, returning it to inbox) appears to use a different mechanism in OmniFocus that isn't currently exposed.

## Potential Solutions

### Option 1: Use `assignedContainer` property
In OmniFocus JXA, setting `assignedContainer` to `null` or to the inbox document may achieve this:
```javascript
task.assignedContainer = null;
// or
task.assignedContainer = doc.inbox;
```

### Option 2: Use `moveTasks` method
OmniFocus has a `moveTasks` method that can relocate tasks:
```javascript
app.moveTasks([task], { to: doc.inbox });
```

### Option 3: Alternative property
Check if there's a `containingProject` property that can be cleared:
```javascript
task.containingProject = null;
```

## Use Case

During task triage, users often discover tasks that were incorrectly filed into projects and need to be returned to inbox for proper processing. This is a common GTD workflow where items captured quickly get refined later.

## Environment

- OmniFocus MCP Server version: 1.8.x
- OmniFocus 4 Pro for Mac
- Discovered: 2026-01-04

## Workaround

Currently, users must manually move tasks to inbox via the OmniFocus UI.
