# Seshat Integration Documentation

Documentation for integrating of-mcp with seshat AI assistant skills.

## Documents

| File | Description | Status |
|------|-------------|--------|
| [skill-optimizations.md](skill-optimizations.md) | Batch operation optimizations for reset-habits, project-review, omnifocus-audit | Ready to implement |
| [sprint9-integration.md](sprint9-integration.md) | How to use Sprint 9 features (untagged filter, includeDropped, project tags) | Ready to implement |
| [sprint10-integration.md](sprint10-integration.md) | Future integration after Sprint 10 ships | Pending Sprint 10 |

## Quick Links

**Current features (v1.26.0):**
- `untagged: true` filter for finding uncategorized tasks
- `includeDropped: true` for searching dropped tags
- Tag operations on projects (`itemType: "project"`)

**Planned features (Sprint 10):**
- `get_system_health` tool (#54)
- `get_completion_stats` tool (#55)
- `countOnly` mode for filter_tasks (#56)
