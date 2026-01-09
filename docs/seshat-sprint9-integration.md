# Seshat Integration: Sprint 9 Features

> How seshat skills can leverage new of-mcp v1.26.0 features from Sprint 9.

---

## New Features Available

### 1. `untagged` Filter (Sprint 9C)

**Tool**: `filter_tasks`
**Parameter**: `untagged: true`
**Purpose**: Find tasks with NO tags assigned

```javascript
filter_tasks({
  untagged: true,
  taskStatus: ["Available", "Next"]
})
```

### 2. `includeDropped` Parameter (Sprint 9B)

**Tool**: `get_tasks_by_tag`
**Parameter**: `includeDropped: true`
**Purpose**: Search tasks by dropped/inactive tags (normally excluded)

```javascript
get_tasks_by_tag({
  tagName: "old-project",
  includeDropped: true
})
```

### 3. Tag Operations on Projects (Sprint 9A)

**Tools**: `edit_item`, `batch_edit_items`
**Parameters**: `addTags`, `removeTags`, `replaceTags` with `itemType: "project"`
**Purpose**: Add/remove tags from projects (not just tasks)

```javascript
batch_edit_items({
  edits: [
    {id: "projectId", itemType: "project", addTags: ["priority-high"]}
  ]
})
```

---

## Skill Integration Opportunities

### weekly-review

**Current Step 8 (OmniFocus Health Check):**
```
| Metric | Source |
|--------|--------|
| Inbox | get_inbox_tasks |
| Active Projects | list_projects |
| Next Actions | filter_tasks (Next) |
| Overdue | filter_tasks (overdue) |
```

**Enhancement - Add Untagged Metric:**
```
| Metric | Source | Thresholds |
|--------|--------|------------|
| Inbox | get_inbox_tasks | ≤20 / 21-50 / >50 |
| Active Projects | list_projects | 45-55 / 56-70 / >70 |
| Next Actions | filter_tasks (Next) | 35-40 / ±5 / >±5 |
| Overdue | filter_tasks (overdue) | ≤3% / 3-5% / >5% |
| **Untagged** | **filter_tasks (untagged: true)** | **≤5 / 6-15 / >15** |
```

**Implementation:**
```javascript
// Add to health check queries
filter_tasks({
  untagged: true,
  taskStatus: ["Available", "Next"]
})
→ UNTAGGED_COUNT

// Display in health table
| Untagged | [UNTAGGED_COUNT] | ≤5 | 🟢/🟡/🔴 |
```

**Rationale:** Untagged tasks indicate items that bypassed the triage process or need categorization. A healthy system should have few untagged tasks.

---

### monthly-review

**Current Step 6 (OmniFocus Data):**
```
filter_tasks completedAfter/Before → MONTH_COMPLETIONS
inbox, overdue, flagged counts → OF_HEALTH
```

**Enhancement - Add Untagged to Health:**
```javascript
// Add alongside existing health metrics
filter_tasks({
  untagged: true,
  taskStatus: ["Available", "Next"]
})
→ Include in OF_HEALTH as "Uncategorized tasks"
```

**Suggested Thresholds:**
- 🟢 ≤5 untagged tasks
- 🟡 6-15 untagged tasks
- 🔴 >15 untagged tasks (needs attention)

---

### omnifocus-audit

**Current Step 8-9 (Tag Analysis):**
```
filter_tasks with tagFilter → count per tag
What got done vs what didn't
```

**Enhancement A - Detect Untagged Tasks:**
```javascript
// Add to tag analysis
filter_tasks({
  untagged: true,
  taskStatus: ["Available", "Next", "Blocked"]
})
→ UNTAGGED_TASKS

// Present in Step 9
**Uncategorized tasks:** [count]
These tasks have no action tags and may need triage.
[List task names for review]
```

**Enhancement B - Find Tasks with Dropped Tags:**
```javascript
// For each dropped tag found in list_tags
get_tasks_by_tag({
  tagName: "dropped-tag-name",
  includeDropped: true
})
→ ORPHANED_TASKS

// Present finding
**Tasks with dropped tags:** [count]
These tasks reference tags that are no longer active.
Suggest: Re-tag or complete/drop these tasks.
```

**New Step 8.5: Orphaned Task Detection**
```
## Step 8.5: Find Orphaned Tasks

1. Get dropped tags: list_tags → filter where status = "dropped"
2. For each dropped tag with tasks:
   get_tasks_by_tag({tagName: tag, includeDropped: true})
3. Collect all tasks referencing dropped tags → ORPHANED_TASKS

Present:
| Dropped Tag | Task Count | Suggested Action |
|-------------|------------|------------------|
| old-project | 3 | Re-tag or drop |
| deprecated  | 7 | Review and clean |

Ask: Address now or defer?
```

---

### inbox-triage

**Current Step 3 (Batch Processing):**
```
Process in batches of 10 tasks.
For each batch, display with suggested project routing.
```

**Enhancement - Prioritize Untagged in Suggestions:**
```
When suggesting actions, note if task is untagged:
| # | Task | Suggest |
|---|------|---------|
| 1 | [task] | → `project` |
| 2 | [task] ⚠️ | → `project` (needs tag) |
```

Tasks without tags should be flagged for attention during triage.

---

### project-review

**Current Step 5 (Execute Action):**
```
| Action | Params |
|--------|--------|
| K Keep | markReviewed: true |
| H Hold | newProjectStatus: "onHold" |
| D Drop | newProjectStatus: "dropped" |
```

**Enhancement - Add Tag Actions:**
```
| Action | Params | Notes |
|--------|--------|-------|
| K Keep | markReviewed: true | |
| H Hold | newProjectStatus: "onHold" | |
| D Drop | newProjectStatus: "dropped" | |
| **[A] Add Tag** | **addTags: [tag]** | **Tag the project for categorization** |
| **[R] Remove Tag** | **removeTags: [tag]** | **Clean up project tags** |
```

**Use case:** During review, add priority tags to projects (e.g., "focus-q1", "priority-high") to aid filtering later.

---

## Implementation Priority

| Skill | Feature | Effort | Impact |
|-------|---------|--------|--------|
| weekly-review | Add untagged metric | Low | High |
| monthly-review | Add untagged metric | Low | Medium |
| omnifocus-audit | Untagged detection | Low | High |
| omnifocus-audit | Dropped tag orphans | Medium | High |
| inbox-triage | Flag untagged tasks | Low | Medium |
| project-review | Tag actions | Low | Low |

**Recommended order:**
1. weekly-review + monthly-review (same change, apply to both)
2. omnifocus-audit (both enhancements)
3. inbox-triage
4. project-review

---

## Quick Reference

### filter_tasks with untagged
```javascript
filter_tasks({
  untagged: true,           // NEW: tasks with no tags
  taskStatus: ["Available", "Next"],
  limit: 50
})
```

### get_tasks_by_tag with includeDropped
```javascript
get_tasks_by_tag({
  tagName: "some-tag",
  includeDropped: true      // NEW: include dropped/inactive tags
})
```

### Tag operations on projects
```javascript
edit_item({
  id: "projectId",
  itemType: "project",      // Works on projects now!
  addTags: ["priority-high"]
})
```

---

*For of-mcp v1.26.0 (Sprint 9A/B/C)*
