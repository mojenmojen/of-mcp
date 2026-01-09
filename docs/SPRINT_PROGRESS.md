# Sprint Progress - Codebase Robustness Initiative

> **Last Updated**: January 9, 2026
> **Branch**: `main`
> **Current Version**: 1.26.0

## Completed Sprints

### Sprint 1: "Stop Hiding Problems" ✅
**Commit**: `b024844`

| Issue | Title | Status |
|-------|-------|--------|
| #5 | CR-01: Fix unsafe `as Error` type casting | ✅ Done |
| #6 | CR-05: Stop swallowing errors in script execution | ✅ Done |
| #7 | HP-12: Add try/finally for temp file cleanup | ✅ Done |
| #8 | HP-14: Fix literal `\n` in getTodayCompletedTasks | ✅ Done |

### Sprint 2: "Quick Performance Wins" ✅
**Commit**: `950ce0a`

| Issue | Title | Status |
|-------|-------|--------|
| #9 | CR-03: Fix O(n²) tag deduplication | ✅ Done |
| #10 | CR-04: Cache tag lookups in batch operations | ✅ Done |
| #11 | HP-07: Pre-compute timestamps for sorting | ✅ Done |
| #12 | HP-08: Fix redundant Map.has()+get() | ✅ Done |

### Sprint 3: "Reduce Maintenance Burden" ✅

| Issue | Title | Status |
|-------|-------|--------|
| #13 | CR-07: Move taskStatusMap to sharedUtils.js | ✅ Done |
| #14 | CR-08: Extract repetitionRuleSchema to shared module | ✅ Done |
| #15 | HP-11: Move formatDate to sharedUtils.js | ✅ Done |
| #16 | HP-01: Remove dump_database dead code | ✅ Done |
| #17 | HP-02: Delete unused yesterdayCompletedTasks.js | ✅ Done |

**Changes made**:
- Added `formatDate()` and `taskStatusMap` to `src/utils/omnifocusScripts/lib/sharedUtils.js`
- Created `src/schemas/repetitionRule.ts` with shared Zod schema
- Removed duplicate code from 7 OmniJS scripts (inboxTasks, flaggedTasks, forecastTasks, tasksByTag, filterTasks, batchFilterTasks, omnifocusDump)
- Updated 3 definition files to import shared schema (addOmniFocusTask, editItem, batchEditItems)
- Deleted dead code: `dumpDatabase.ts` (both locations), `yesterdayCompletedTasks.js`
- Removed commented dump_database code from `server.ts`

---

## Codebase Robustness Initiative Complete! 🎉

All 13 issues from the prioritized list have been addressed across 3 sprints.

---

## Next: Feature Requests Roadmap

With the robustness foundation in place, development continues with the **Feature Requests Roadmap** in `docs/feature-requests/README.md`.

### Planned Sprints

| Sprint | Theme | Features | Status |
|--------|-------|----------|--------|
| **Sprint 4** | Foundation Prep | P00A, P00B, 001 | ✅ Done |
| **Sprint 5** | Error Handling & Reliability | 002, 003 | ✅ Done |
| **Sprint 6** | Developer Experience | 004, 008 | ✅ Done |
| **Sprint 7** | Performance | 009 | ✅ Done |
| **Sprint 8** | New Tools | 007, 010, 011 | ✅ Done |
| **Sprint 9** | Tag Operations & Query Improvements | #44-#49 | ✅ Done |

### Sprint 4: Foundation Prep ✅
| # | Feature | Effort |
|---|---------|--------|
| P00A | Execution Timeout | Low |
| P00B | Remove Legacy Injection | Low |
| 001 | Diagnose Connection Tool | Low |

### Sprint 5: Error Handling & Reliability ✅
| # | Feature | Effort |
|---|---------|--------|
| 002 | Error Handling Consolidation | Medium |
| 003 | Retry with Exponential Backoff | Medium |

### Sprint 6: Developer Experience ✅
| # | Feature | Effort |
|---|---------|--------|
| 004 | Logging Cleanup | Low |
| 008 | Cycle Detection | Medium |

### Sprint 7: Performance ✅
| # | Feature | Effort |
|---|---------|--------|
| 009 | Checksum Cache Invalidation | High |

### Sprint 8: New Tools ✅
**PR**: #35

| # | Feature | Effort |
|---|---------|--------|
| 007 | Search Tasks | Low |
| 010 | Duplicate Project | Medium |
| 011 | Edit Tag | Medium |

---

## Feature Requests Roadmap Complete! 🎉

All 11 feature request issues have been implemented across Sprints 4-8.

**Roadmap Changes (January 2026 Review):**
- Removed 005, 006 (JXA-only APIs, no benefit over `filter_tasks`)
- Renamed 002 → "Error Handling Consolidation" (Sprint 1 already fixed error swallowing)
- Renamed 004 → "Logging Cleanup" (aligns with HP-04)

---

## GitHub Issues Created ✅

All feature request issues have been created:

| Issue | Title | Sprint | Labels |
|-------|-------|--------|--------|
| [#18](https://github.com/mojenmojen/of-mcp/issues/18) | P00A: Execution Timeout | Sprint 4 | quick-fix, robustness |
| [#19](https://github.com/mojenmojen/of-mcp/issues/19) | P00B: Remove Legacy Injection | Sprint 4 | quick-fix |
| [#20](https://github.com/mojenmojen/of-mcp/issues/20) | 001: Diagnose Connection Tool | Sprint 4 | enhancement, quick-fix |
| [#21](https://github.com/mojenmojen/of-mcp/issues/21) | 002: Error Handling Consolidation | Sprint 5 | robustness |
| [#22](https://github.com/mojenmojen/of-mcp/issues/22) | 003: Retry with Exponential Backoff | Sprint 5 | robustness |
| [#23](https://github.com/mojenmojen/of-mcp/issues/23) | 004: Logging Cleanup | Sprint 6 | quick-fix |
| [#24](https://github.com/mojenmojen/of-mcp/issues/24) | 008: Cycle Detection | Sprint 6 | robustness |
| [#25](https://github.com/mojenmojen/of-mcp/issues/25) | 009: Checksum Cache Invalidation | Sprint 7 | performance |
| [#26](https://github.com/mojenmojen/of-mcp/issues/26) | 007: Search Tasks | Sprint 8 | enhancement |
| [#27](https://github.com/mojenmojen/of-mcp/issues/27) | 010: Duplicate Project | Sprint 8 | enhancement |
| [#28](https://github.com/mojenmojen/of-mcp/issues/28) | 011: Edit Tag | Sprint 8 | enhancement |

---

## Reference Documents

- **Full Review**: `docs/CODEBASE_REVIEW.md` - Complete 57-issue analysis
- **Feature Roadmap**: `docs/archive/sprint-specs/README.md` - Implemented feature specs
- **GitHub Issues**: #5-#28 created with detailed descriptions

---

### Sprint 9: Tag Operations & Query Improvements ✅
**PRs**: #50, #51, #52

Based on open issues in `docs/issues/`, Sprint 9 addressed critical tag bugs and query enhancements.

#### Issue Summary

| Issue | Title | Resolution |
|-------|-------|------------|
| #44 | Tag operations silent failure on projects | ✅ Fixed in 9A (PR #50) |
| #45 | get_tasks_by_tag ignores dropped tags | ✅ Fixed in 9B (PR #51) |
| #46 | Task IDs missing from perspective output | ✅ Already implemented |
| #47 | No way to filter untagged tasks | ✅ Fixed in 9C (PR #52) |
| #48 | `inInbox` filter returns wrong results | ✅ Code was correct |
| #49 | False "moved to folder" success message | ✅ Already fixed |

#### Sprint 9A: Tag Operations on Projects ✅
**PR**: #50 | **Version**: 1.24.0

- Fixed tag operations (`addTags`, `removeTags`, `replaceTags`) to work on both tasks AND projects
- Root cause: `if (itemType === 'task')` guards incorrectly skipped tag operations for projects
- Files changed: `editItem.js`, `batchEditItems.js`, `editItem.ts`, `batchEditItems.ts`
- Renamed `editTask.js` → `editItem.js` for clarity

#### Sprint 9B: Query Improvements ✅
**PR**: #51 | **Version**: 1.25.0

- Added `includeDropped` parameter to `get_tasks_by_tag`
- Allows searching tasks by dropped/inactive tags
- Closed #46: All perspective tools already include task IDs in output

#### Sprint 9C: Filter Enhancements ✅
**PR**: #52 | **Version**: 1.26.0

- Added `untagged` parameter to `filter_tasks`
- Use case: Find unorganized tasks after bulk tag removal
- Closed #48: `inInbox` filter logic was already correct

#### Sprint 9D: Polish ✅
- Closed #49: Fix was already in codebase (commit `ef731f5`)
- `editItem.js` already checks if project is in target folder before reporting move

---

## Next: Sprint 10 - AI Assistant Optimizations

Based on analysis of real-world AI assistant usage patterns, Sprint 10 focuses on reducing API calls for common health check and analytics workflows.

### Sprint 10 Overview

| Issue | Feature | Effort | Impact |
|-------|---------|--------|--------|
| #54 | `get_system_health` tool | Medium | High |
| #55 | `get_completion_stats` tool | Medium | High |
| #56 | `countOnly` mode for filter_tasks | Low | Medium |

### Issue Details

#### #54: get_system_health Tool

**Problem:** Health checks require 4-6 separate API calls:
- `get_inbox_tasks` → inbox count
- `list_projects` → project counts
- `filter_tasks` (taskStatus: Next) → next action count
- `filter_tasks` (overdue: true) → overdue count
- `filter_tasks` (untagged: true) → untagged count
- `get_flagged_tasks` → flagged count

**Solution:** Single tool returning all metrics:
```javascript
get_system_health()
// Returns:
{
  inbox: 12,
  projects: {active: 45, onHold: 8, dropped: 23, completed: 156},
  tasks: {available: 234, next: 38, blocked: 12, overdue: 5, dueSoon: 8},
  untagged: 3,
  flagged: 7,
  tags: {active: 45, onHold: 3, dropped: 12}
}
```

**Use cases:**
- Weekly review health checks
- Monthly review dashboards
- Daily standup metrics
- of-stats recording

#### #55: get_completion_stats Tool

**Problem:** Completion analytics require N API calls (one per project/tag):
```
filter_tasks({projectFilter: "proj1", completedAfter: date})
filter_tasks({projectFilter: "proj2", completedAfter: date})
...
```

**Solution:** Single tool with grouping:
```javascript
get_completion_stats({
  completedAfter: "2026-01-01",
  completedBefore: "2026-01-31",
  groupBy: "project"  // or "tag" or "folder"
})
// Returns:
{
  period: {start: "2026-01-01", end: "2026-01-31"},
  totalCompleted: 87,
  byGroup: [
    {name: "Project A", count: 23, percentage: 26.4},
    {name: "Project B", count: 18, percentage: 20.7},
    ...
  ]
}
```

**Use cases:**
- Weekly review completion summaries
- Monthly review priority distribution
- Omnifocus audit tag analysis

#### #56: countOnly Mode for filter_tasks

**Problem:** Health checks only need counts, but `filter_tasks` returns full task data.

**Solution:** Add `countOnly: true` parameter:
```javascript
filter_tasks({
  taskStatus: ["Available", "Next"],
  countOnly: true  // Returns count only, not task data
})
// Returns:
{
  count: 156,
  filters: {...}
}
```

**Benefits:**
- Faster response (no serialization of task data)
- Lower memory usage
- Ideal for dashboards and health checks

### Sprint 10 Dependencies

```
#56 (countOnly) - Independent, can ship first
#54 (health) - May use countOnly internally
#55 (stats) - Independent
```

### Implementation Notes

- All new tools should leverage existing OmniJS scripts where possible
- Health metrics should use the same thresholds as documented in seshat skills
- Consider caching for get_system_health (changes infrequently during a session)
