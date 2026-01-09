# Sprint Progress - Codebase Robustness Initiative

> **Last Updated**: January 8, 2026
> **Branch**: `main`
> **Current Version**: 1.23.1

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

## Next: Bug Fixes & Enhancements

### Sprint 9: Tag Operations & Query Improvements

Based on open issues in `docs/issues/`, Sprint 9 addresses critical tag bugs and query enhancements.

#### Issue Analysis

| ID | Issue | Type | Severity | Root Cause |
|----|-------|------|----------|------------|
| A | Tag operations silent failure | BUG | HIGH | Under investigation |
| B | Project tag edit requires `itemType: "task"` | BUG | HIGH | `if (itemType === 'task')` guards skip projects |
| C | get_tasks_by_tag ignores dropped tags | BUG | MEDIUM | `flattenedTags.filter(tag => tag.active)` |
| D | Task IDs missing from perspective output | FEAT | MEDIUM | Not included in formatters |
| E | No way to filter untagged tasks | FEAT | LOW | Missing parameter |
| F | `inInbox` filter returns wrong results | BUG | MEDIUM | Logic issue |
| G | False "moved to folder" success message | BUG | LOW | Missing "already in folder" check |

#### Sprint 9A: Tag Operations (Critical)

| Item | Issue | File | Effort |
|------|-------|------|--------|
| B | Fix project tag editing | `batchEditItems.js`, `editItem.js` | Low |
| A | Verify tag operations work after B | Testing | Low |

**Root cause for B**: Lines 251, 263, 271 in `batchEditItems.js` have `if (itemType === 'task')` guards that skip tag operations for projects.

#### Sprint 9B: Query Improvements

| Item | Issue | File | Effort |
|------|-------|------|--------|
| C | Add `includeDropped` param to get_tasks_by_tag | `tasksByTag.js` | Low |
| D | Add task IDs to perspective tool output | Multiple formatters | Medium |

**Root cause for C**: Line 42 in `tasksByTag.js` filters `flattenedTags.filter(tag => tag.active)`.

#### Sprint 9C: Filter Enhancements

| Item | Issue | File | Effort |
|------|-------|------|--------|
| E | Add `untagged: true` param to filter_tasks | `filterTasks.js` | Low |
| F | Fix inInbox filter logic | `filterTasks.js` | Medium |

#### Sprint 9D: Polish

| Item | Issue | File | Effort |
|------|-------|------|--------|
| G | Add "already in folder" check | `editItem.js` | Low |

#### Dependencies

```
A ←── B (same code area, fix B first to see if A resolves)
D includes fix for get_inbox_tasks missing IDs
C, E, F, G are independent
```

#### Source Issues

- `docs/issues/bugs/2026-01-06-batch-edit-tags-silent-failure.md` (A)
- `docs/issues/bugs/2026-01-08-project-tag-edit-requires-task-itemtype.md` (B)
- `docs/issues/bugs/bug-get-tasks-by-tag-dropped-tags.md` (C)
- `docs/issues/features/feature-request-perspective-task-ids.md` (D)
- `docs/issues/features/2026-01-08-untagged-tasks-filter.md` (E)
- `docs/issues/bugs/mcp-omnifocus-bug-report.md` (F, plus overlap with D)
- `docs/issues/bugs/mcp-omnifocus-bug-false-move-success.md` (G)
