# Seshat Integration: Sprint 10 Features

> **Status: ✅ Ready** (of-mcp v1.27.0)

How seshat skills can leverage of-mcp Sprint 10 features.

---

## Available Features

### 1. `get_system_health` Tool (#54)

Returns all health metrics in a single call:

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

### 2. `get_completion_stats` Tool (#55)

Returns completion counts grouped by project/tag/folder:

```javascript
get_completion_stats({
  completedAfter: "2026-01-01",
  completedBefore: "2026-01-31",
  groupBy: "project"
})
// Returns:
{
  period: {start: "2026-01-01", end: "2026-01-31"},
  totalCompleted: 87,
  byGroup: [
    {name: "Project A", count: 23, percentage: 26.4},
    {name: "Project B", count: 18, percentage: 20.7}
  ]
}
```

### 3. `countOnly` Mode for filter_tasks (#56)

Returns just the count, not full task data:

```javascript
filter_tasks({
  taskStatus: ["Available", "Next"],
  countOnly: true
})
// Returns: {count: 156, filters: {...}}
```

---

## Skill Integration Plans

### weekly-review

**Current Step 8 (OmniFocus Health Check) - 6 API calls:**
```
get_inbox_tasks → inbox count
list_projects → project counts
filter_tasks (Next) → next action count
filter_tasks (overdue) → overdue count
filter_tasks (untagged) → untagged count
get_flagged_tasks → flagged count
```

**After Sprint 10 - 1 API call:**
```
## Step 8: Gather OmniFocus Health

get_system_health() → HEALTH_DATA

Display health table using HEALTH_DATA:
| Metric | Current | Baseline | Status |
|--------|---------|----------|--------|
| Inbox | HEALTH_DATA.inbox | <20 | 🟢/🟡/🔴 |
| Active Projects | HEALTH_DATA.projects.active | 45-55 | 🟢/🟡/🔴 |
| Next Actions | HEALTH_DATA.tasks.next | 35-40 | 🟢/🟡/🔴 |
| Overdue | HEALTH_DATA.tasks.overdue | ≤3% | 🟢/🟡/🔴 |
| Untagged | HEALTH_DATA.untagged | ≤5 | 🟢/🟡/🔴 |
| Flagged | HEALTH_DATA.flagged | info | — |
```

**Performance improvement:** 6 calls → 1 call (~5x faster)

---

**Current Step 8 (Completion Summary) - N API calls:**
```
filter_tasks completedAfter/Before → group by project manually
```

**After Sprint 10 - 1 API call:**
```
get_completion_stats({
  completedAfter: START_DATE,
  completedBefore: END_DATE,
  groupBy: "project"
}) → COMPLETION_DATA

Display:
Total completed: COMPLETION_DATA.totalCompleted

By project:
[Loop through COMPLETION_DATA.byGroup]
- Project A: 23 (26%)
- Project B: 18 (21%)
...
```

---

### monthly-review

**Current Step 6 (OmniFocus Data):**
```
filter_tasks completedAfter/Before → MONTH_COMPLETIONS
inbox, overdue, flagged counts → OF_HEALTH (multiple calls)
Map completions to priorities manually
```

**After Sprint 10:**
```
## Step 6: Gather OmniFocus Data

// Health in one call
get_system_health() → HEALTH_DATA

// Completions by project in one call
get_completion_stats({
  completedAfter: REVIEW_MONTH_START,
  completedBefore: REVIEW_MONTH_END,
  groupBy: "project"
}) → PROJECT_COMPLETIONS

// Completions by tag in one call (for triplet analysis)
get_completion_stats({
  completedAfter: REVIEW_MONTH_START,
  completedBefore: REVIEW_MONTH_END,
  groupBy: "tag"
}) → TAG_COMPLETIONS

Map PROJECT_COMPLETIONS to priorities via PRIORITY_MAP
Map TAG_COMPLETIONS to triplet categories
```

**Performance improvement:** ~10+ calls → 3 calls

---

### omnifocus-audit

**Current Step 8 (Tag Analysis) - 15+ API calls:**
```
For each action tag:
  filter_tasks with tagFilter → count
```

**After Sprint 10 - 1 API call:**
```
## Step 8: Gather Tag Data

get_completion_stats({
  completedAfter: REVIEW_MONTH_START,
  completedBefore: REVIEW_MONTH_END,
  groupBy: "tag"
}) → TAG_STATS

Build output table from TAG_STATS.byGroup:
| Tag | Completed | % |
|-----|-----------|---|
| dev | 23 | 26% |
| read | 18 | 21% |
...

Identify dormant tags (not in TAG_STATS.byGroup or count=0)
```

**Performance improvement:** 15+ calls → 1 call (~15x faster)

---

### of-stats

**Current flow:**
1. User runs external OmniFocus script
2. User pastes output
3. Skill parses and records to spreadsheet

**After Sprint 10:**
```
## Step 1: Get Stats Directly

get_system_health() → HEALTH_DATA

## Step 2: Map to Spreadsheet Format

Row data:
- TODAY_DATE
- HEALTH_DATA.inbox
- HEALTH_DATA.projects.active
- HEALTH_DATA.projects.onHold
- HEALTH_DATA.projects.dropped
- HEALTH_DATA.tags.active
- HEALTH_DATA.tags.onHold
- HEALTH_DATA.tags.dropped
- HEALTH_DATA.tasks.blocked
- HEALTH_DATA.tasks.available
- HEALTH_DATA.tasks.next
- (completed count - may need separate query)
- HEALTH_DATA.tasks.dueSoon
- HEALTH_DATA.tasks.overdue
- (dropped count - may need separate query)

## Step 3: Write to Sheet
(unchanged)
```

**User experience improvement:** No more manual script + paste workflow

---

### project-review

**Current Step 4 (per-project queries):**
```
For each project:
  get_project_by_id → metadata
  filter_tasks → task list
```

**After Sprint 10:**

For quick count display, use `countOnly`:
```
filter_tasks({
  projectId: PROJECT_ID,
  taskStatus: ["Available", "Next", "Blocked", "Overdue"],
  countOnly: true
}) → Just the count for summary view
```

Then fetch full task list only when user selects a project for detailed review.

---

## Implementation Priority

| Skill | Sprint 10 Feature | Effort | Impact |
|-------|-------------------|--------|--------|
| weekly-review | get_system_health | Low | High |
| weekly-review | get_completion_stats | Low | Medium |
| monthly-review | get_system_health | Low | High |
| monthly-review | get_completion_stats (x2) | Low | High |
| omnifocus-audit | get_completion_stats | Low | Very High |
| of-stats | get_system_health | Medium | High (UX) |
| project-review | countOnly | Low | Low |

**Recommended implementation order:**
1. weekly-review (highest usage)
2. monthly-review (similar changes)
3. omnifocus-audit (biggest performance win)
4. of-stats (nice UX improvement)
5. project-review (minor optimization)

---

## Migration Notes

### Backward Compatibility

All existing API calls will continue to work. These are additive optimizations.

### Gradual Migration

Skills can migrate incrementally:
1. Add Sprint 10 calls alongside existing calls
2. Verify results match
3. Remove old calls

### Feature Detection

Check of-mcp version before using new features:
```
get_server_version() → if >= 1.27.0, use Sprint 10 features
```

---

*Planned for of-mcp v1.27.0+ (Sprint 10)*
