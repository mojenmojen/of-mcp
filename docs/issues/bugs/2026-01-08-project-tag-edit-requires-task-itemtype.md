# Bug: Editing project tags requires itemType "task" instead of "project"

**Date discovered:** 2026-01-08
**MCP version:** 1.23.1
**Tool affected:** `batch_edit_items` (and likely `edit_item`)

## Summary

When attempting to add or remove tags from a project using `batch_edit_items` with `itemType: "project"`, the operation silently succeeds but no tags are actually modified. Using `itemType: "task"` for the same project ID works correctly.

## Steps to Reproduce

1. Get a project ID (e.g., via `list_projects`)
2. Call `batch_edit_items` with:
   ```json
   {
     "edits": [{
       "id": "<project-id>",
       "itemType": "project",
       "removeTags": ["some-tag"]
     }]
   }
   ```
3. Observe: Tool returns success, but tag remains on the project

4. Call the same operation with `itemType: "task"`:
   ```json
   {
     "edits": [{
       "id": "<project-id>",
       "itemType": "task",
       "removeTags": ["some-tag"]
     }]
   }
   ```
5. Observe: Tag is successfully removed

## Expected Behavior

Using `itemType: "project"` with a project ID should correctly modify the project's tags.

## Actual Behavior

- `itemType: "project"` + project ID = silent failure (reports success, no change)
- `itemType: "task"` + project ID = works correctly (but semantically incorrect)

## Context

Discovered while removing the "area" tag from 6 projects. Initial attempts with `itemType: "project"` appeared successful but tags remained. Switching to `itemType: "task"` resolved the issue.

## Impact

- Users cannot reliably edit project tags using the correct itemType
- Workaround exists but is confusing and semantically wrong
- Silent failure makes debugging difficult

## Suggested Fix

Investigate why the project tag modification path doesn't apply changes. The task path appears to work for both tasks and projects, suggesting the project-specific code path may be missing tag handling logic.
