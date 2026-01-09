# OmniFocus MCP Server - What's New (v1.26.0)

> Summary of changes from Sprints 1-9 for AI assistants using this MCP server.

## Efficiency Guidelines (IMPORTANT)

**Always prefer batch operations over individual calls:**

| Instead of... | Use... | Benefit |
|---------------|--------|---------|
| Multiple `add_omnifocus_task` calls | `batch_add_items` | 9x faster |
| Multiple `edit_item` calls | `batch_edit_items` | 12x faster |
| Multiple `remove_item` calls | `batch_remove_items` | 9x faster |
| Multiple `filter_tasks` calls for different projects | `batch_filter_tasks` | Single API call |

**Caching**: Repeated read queries (`filter_tasks`, `search_tasks`, `get_task_by_id`) are now cached. The cache auto-invalidates when you make changes.

---

## New Tools

### Sprint 8: New Tools
| Tool | Description |
|------|-------------|
| `search_tasks` | Full-text search across task names and notes. Simpler than filter_tasks for text searches. Supports: contains, anyWord, allWords, exact match modes. |
| `duplicate_project` | Copy a project with all tasks. Great for templates. Supports date shifting, hierarchy preservation. |
| `edit_tag` | Change tag status (active/onHold/dropped), rename, move to different parent. Use to reactivate dropped tags. |

### Sprint 4: Diagnostics
| Tool | Description |
|------|-------------|
| `diagnose_connection` | Check OmniFocus connectivity and permissions. Run this first if experiencing issues. |

---

## Performance Improvements

### Query Caching (Sprint 7)
- `filter_tasks`, `search_tasks`, `get_task_by_id` results are cached
- Cache validates via database checksum (task count + modification time)
- Repeated identical queries return instantly (<100ms vs 3-4s)
- Cache auto-invalidates on any write operation

### Retry with Backoff (Sprint 5)
- Transient OmniFocus errors automatically retry (up to 3 attempts)
- Exponential backoff prevents overwhelming OmniFocus

---

## Reliability Improvements

### Error Handling (Sprints 1, 5)
- Errors now propagate with clear messages instead of being swallowed
- Execution timeout prevents hung operations (30s default)
- Consolidated error handling across all tools

### Cycle Detection (Sprint 6)
- Batch operations detect circular parent references
- Prevents infinite loops when creating task hierarchies

---

## Enhanced Capabilities

### list_tags Enhancement
- Now shows tag status: active, (on hold), (dropped)
- Use `edit_tag` to reactivate dropped tags

### Sprint 9B: get_tasks_by_tag Enhancement
- **New parameter**: `includeDropped: true` to search tasks by dropped/inactive tags
- Default behavior unchanged (only searches active tags)
- Use case: Find tasks blocked by tags that were later dropped

### Sprint 9C: filter_tasks Enhancement
- **New parameter**: `untagged: true` to filter for tasks with NO tags assigned
- Use case: Find unorganized tasks after bulk tag removal
- Example: `filter_tasks {"untagged": true, "taskStatus": ["Available"]}`

---

## Bug Fixes

### Sprint 9A: Project Tag Operations
- **Fixed**: Tag operations (`addTags`, `removeTags`, `replaceTags`) now work on **both tasks and projects**
- Previously, using `itemType: "project"` with tag operations would silently succeed without making changes
- Now you can properly add/remove tags from projects using `edit_item` and `batch_edit_items`

---

## Tool Count

**Total: 29 tools**

| Category | Tools |
|----------|-------|
| Task CRUD | add_omnifocus_task, edit_item, remove_item |
| Batch Operations | batch_add_items, batch_edit_items, batch_remove_items |
| Queries | filter_tasks, batch_filter_tasks, search_tasks, get_task_by_id |
| Perspectives | get_inbox_tasks, get_flagged_tasks, get_forecast_tasks, get_tasks_by_tag, get_custom_perspective_tasks, list_custom_perspectives |
| Projects/Folders | add_project, add_folder, list_projects, get_project_by_id, get_folder_by_id, duplicate_project |
| Tags | list_tags, edit_tag |
| Review | get_projects_for_review, batch_mark_reviewed |
| Utility | get_server_version, diagnose_connection, get_today_completed_tasks |

---

## Best Practices Summary

1. **Use batch tools** for 2+ operations (9-12x faster)
2. **Let caching work** - don't worry about repeated reads
3. **Use `search_tasks`** for simple text searches instead of `filter_tasks`
4. **Use `batch_filter_tasks`** when querying multiple projects
5. **Check `diagnose_connection`** first if operations fail
6. **Use IDs over names** when available (more reliable)
