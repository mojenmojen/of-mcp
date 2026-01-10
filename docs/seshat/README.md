# Seshat Integration Documentation

Documentation for integrating of-mcp with seshat AI assistant skills.

## ⚠️ v1.27.1 Update (January 2026)

**Bug fix release** - IDs now included in add/create responses:

```
# Before v1.27.1
✅ Task "Buy milk" created successfully in your inbox.

# After v1.27.1
✅ Task "Buy milk" (id: abc123) created successfully in your inbox.
```

**Impact on seshat skills:**
- `batch_add_items` now returns IDs directly - no need to search for created items
- Fixes the `/today` reset-habits issue where skill had to search for task IDs after creation
- `add_omnifocus_task` and `add_project` also return IDs

**search_tasks safeguard:**
- Searches returning >500 matches (without project filter) now return guidance instead of timing out
- Specific searches on large databases work fine

See [WHATS_NEW.md](../WHATS_NEW.md) for full details.

---

## Documents

| File | Description | Status |
|------|-------------|--------|
| [skill-optimizations.md](skill-optimizations.md) | Batch operation optimizations for reset-habits, project-review, omnifocus-audit | ✅ Implemented |
| [sprint9-integration.md](sprint9-integration.md) | How to use Sprint 9 features (untagged filter, includeDropped, project tags) | ✅ Implemented |
| [sprint10-integration.md](sprint10-integration.md) | Sprint 10 AI assistant optimizations (health, stats, countOnly) | ✅ Implemented |

## Quick Links

**Current features (v1.27.1):**
- IDs in add/create responses - Chain operations without searching
- `get_system_health` tool - All health metrics in one call
- `get_completion_stats` tool - Completion analytics by project/tag/folder
- `countOnly: true` mode for filter_tasks - Fast counts without task data
- `untagged: true` filter for finding uncategorized tasks
- `includeDropped: true` for searching dropped tags
- Tag operations on projects (`itemType: "project"`)
- Result-count safeguard for search_tasks (>500 matches returns guidance)
