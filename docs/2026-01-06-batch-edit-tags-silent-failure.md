# Bug Report: Tag Operations Silent Failure (addTags/removeTags)

**Date**: 2026-01-06
**MCP Server**: omnifocus-mcp-enhanced v1.15.1 (Node v23.7.0, darwin)
**Severity**: High - Data loss / Silent failure
**Affected Tools**: `batch_edit_items`, `edit_item`

## Summary

Both `batch_edit_items` and `edit_item` tools report success for `addTags` and `removeTags` operations but do not actually apply the changes to OmniFocus. This affects creating new tags and modifying existing tag assignments.

## Steps to Reproduce

1. Query tasks with existing tag (e.g., "admin")
2. Use `batch_edit_items` to add a new tag and remove the existing tag:
   ```json
   {
     "edits": [
       {
         "id": "pRtXEoNJ-yU",
         "itemType": "task",
         "addTags": ["note"],
         "removeTags": ["admin"]
       }
     ]
   }
   ```
3. Tool returns success:
   ```
   ✅ Batch edit complete: 23 succeeded
   - ✅ task "pRtXEoNJ-yU": tags (added), tags (removed)
   ```
4. Query tasks by new tag ("note") - returns 0 results
5. Query tasks by original tag ("admin") - still shows all original tasks

## Expected Behavior

- New tags should be created in OmniFocus if they don't exist
- Tasks should have new tags added
- Tasks should have specified tags removed
- If operation fails, tool should return error, not success

## Actual Behavior

- Tool reports success for all operations
- No tags are actually created or modified in OmniFocus
- No error messages or warnings
- Original tag state unchanged

## Test Data

### Attempted Edits (all reported success, none applied):
- 23 tasks: admin → note
- 8 tasks: admin → pay
- 10 tasks: admin → schedule
- 16 tasks: admin → ping
- 17 tasks: admin → setup
- 4 tasks: admin → clear
- 12 tasks: remove admin (keep prep)

**Total: 90 "successful" edits that didn't apply**

### Verification Queries:
```
get_tasks_by_tag(tagName: "note") → "No tasks found"
get_tasks_by_tag(tagName: "admin") → 133 tasks (unchanged)
get_tasks_by_tag(tagName: ["note", "pay", "schedule", "ping", "setup", "clear"]) → "No tasks found"
```

## Environment

- macOS
- OmniFocus 4 (Pro)
- mcp-omnifocus server

## Impact

- Users cannot batch edit tags
- Silent failures lead to wasted effort and confusion
- Data appears to be modified but isn't
- Breaks workflows that depend on tag organization

## Workaround

**None found.** Single `edit_item` calls also fail silently:

```
edit_item(id: "pRtXEoNJ-yU", itemType: "task", addTags: ["note"], removeTags: ["admin"])
→ ✅ Task "note expiration of zoom account on 13th Mar 2026" updated successfully (tags (added), tags (removed)).

get_tasks_by_tag(tagName: "note")
→ "No tasks found with tag 'note'"
```

The bug affects all tag modification operations, not just batch edits.

## Additional Notes

The `get_task_by_id` response doesn't include tag information, making it harder to verify individual task state. Would be helpful if task details included current tags.
