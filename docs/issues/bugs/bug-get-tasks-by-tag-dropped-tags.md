# Bug: get_tasks_by_tag doesn't find tasks on dropped tags

## Summary

When querying tasks by a dropped tag's ID, `get_tasks_by_tag` returns no results even when tasks exist using that tag. This makes it impossible to find tasks that are blocked due to dropped tags.

## Steps to Reproduce

1. Have a task with a tag that is dropped (e.g., `inbox-old`)
2. Get the dropped tag's ID from `list_tags` (with `includeDropped: true`)
3. Query using `get_tasks_by_tag` with that tag ID
4. Result: "No tasks found" even though tasks exist

## Expected Behavior

The tool should return all tasks using the specified tag, regardless of whether the tag is active, on hold, or dropped.

## Actual Behavior

Tasks on dropped tags are silently excluded from results. The tool returns "No tasks found" with no indication that results were filtered.

## Impact

- **High** - Users cannot identify tasks blocked by dropped tags
- Makes tag cleanup dangerous (can't verify a dropped tag is truly empty before deleting)
- The `list_tags` tool with `showTaskCounts: true` shows counts, but `get_tasks_by_tag` can't retrieve those tasks

## Suggested Fix

The OmniJS script should search through `flattenedTasks` (which includes all tasks) rather than relying on `tag.tasks` or `tag.availableTasks` which may filter based on tag status.

Alternative: Add an `includeDroppedTags` parameter similar to `list_tags`.

## Workaround

Currently none via MCP. User must manually inspect dropped tags in OmniFocus UI.

## Environment

- of-mcp version: (current)
- Discovered: 2026-01-08
- Context: User had tasks blocked by dropped `inbox-old` tag that the scan couldn't find

## Related

- `list_tags` correctly shows dropped tags with task counts
- The disconnect between `list_tags` showing counts and `get_tasks_by_tag` not finding them is confusing
