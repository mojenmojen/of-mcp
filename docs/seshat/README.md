# Seshat Integration Documentation

Documentation for integrating of-mcp with seshat AI assistant skills.

## Documents

| File | Description | Status |
|------|-------------|--------|
| [skill-optimizations.md](skill-optimizations.md) | Batch operation optimizations for reset-habits, project-review, omnifocus-audit | ✅ Implemented |
| [sprint9-integration.md](sprint9-integration.md) | How to use Sprint 9 features (untagged filter, includeDropped, project tags) | ✅ Implemented |
| [sprint10-integration.md](sprint10-integration.md) | Sprint 10 AI assistant optimizations (health, stats, countOnly) | ✅ Implemented |

## Quick Links

**Current features (v1.27.0):**
- `get_system_health` tool - All health metrics in one call
- `get_completion_stats` tool - Completion analytics by project/tag/folder
- `countOnly: true` mode for filter_tasks - Fast counts without task data
- `untagged: true` filter for finding uncategorized tasks
- `includeDropped: true` for searching dropped tags
- Tag operations on projects (`itemType: "project"`)
