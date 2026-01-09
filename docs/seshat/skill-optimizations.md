# Seshat Skill Optimization Plans

> **Status: ✅ Implemented** (January 2026)

Implementation plans for optimizing OmniFocus MCP server usage in seshat skills.
These optimizations leverage batch operations for 9-12x performance improvements.

---

## 1. reset-habits Optimization

### Current Issue

**Step 5** makes 3 sequential `get_task_by_id` calls to retrieve parent task IDs:

```
get_task_by_id with taskName for each → MORNING_ID, WORKDAY_ID, EVENING_ID
```

This is redundant because `batch_add_items` in Step 4 already returns the created task IDs in its response.

### Performance Impact

- **Current**: 3 additional API calls (sequential)
- **After fix**: 0 additional API calls
- **Savings**: ~1-2 seconds per execution

### Implementation Plan

#### Step 4 Change: Capture IDs from Response

**Current Step 4:**
```
batch_add_items with parent tasks: name, projectName, tags, deferDate/dueDate
```

**Updated Step 4:**
```
batch_add_items with parent tasks: name, projectName, tags, deferDate/dueDate

→ PARENT_RESPONSE = batch_add_items response

Parse response to extract IDs:
- MORNING_ID = PARENT_RESPONSE.results[0].id (where name matches morning habit)
- EVENING_ID = PARENT_RESPONSE.results[1].id (where name matches evening habit)
- WORKDAY_ID = PARENT_RESPONSE.results[2].id (if weekday, where name matches workday habit)

Note: Match by name in response since order may not be guaranteed.
```

#### Step 5 Change: Remove Entirely

**Current Step 5:**
```
get_task_by_id with taskName for each → MORNING_ID, WORKDAY_ID, EVENING_ID
```

**Updated Step 5:**
```
[REMOVED - IDs now captured in Step 4]
```

Renumber subsequent steps (Step 6 becomes Step 5, etc.)

#### Response Format Reference

`batch_add_items` returns:
```json
{
  "results": [
    {"success": true, "id": "abc123", "name": "Morning Habits"},
    {"success": true, "id": "def456", "name": "Evening Habits"},
    {"success": true, "id": "ghi789", "name": "Workday Habits"}
  ],
  "summary": {...}
}
```

#### Error Handling

Add check after Step 4:
```
If any parent task creation failed (success: false):
  - Log which parent failed
  - Skip creating children for that parent
  - Continue with remaining parents
```

---

## 2. project-review Optimization

### Current Issue

**Step 4** makes 2 API calls per project being reviewed:

```
For each project:
  1. get_project_by_id → task count, review interval, last reviewed, status
  2. filter_tasks with projectFilter → task list
```

For 20 projects due for review, this is 40 sequential API calls.

### Performance Impact

- **Current**: 2N API calls for N projects (sequential)
- **After fix**: 2 API calls total (batched)
- **Savings**: For 20 projects: ~30-60 seconds → ~2-4 seconds

### Implementation Plan

#### New Step 3.5: Batch Fetch All Project Data

Insert between current Step 3 and Step 4:

```
## Step 3.5: Batch Fetch Project Details

After grouping projects by folder, fetch all task data in one call:

PROJECT_IDS = all project IDs from Step 1 response

batch_filter_tasks({
  queries: PROJECT_IDS.map(id => ({
    projectId: id,
    taskStatus: ["Available", "Next", "Blocked", "Overdue", "DueSoon"]
  }))
})

→ PROJECTS_TASK_DATA = Map of projectId → tasks array

Also extract from get_projects_for_review response (already have):
- task count (from response)
- review interval
- last reviewed
- status
```

#### Step 4 Change: Use Cached Data

**Current Step 4:**
```
For each project:
1. get_project_by_id → task count, review interval, last reviewed, status
2. filter_tasks with projectFilter → task list
```

**Updated Step 4:**
```
For each project:
1. Retrieve from PROJECTS_TASK_DATA[project.id]
2. Present using already-fetched data

No additional API calls needed.
```

#### Alternative: Progressive Loading

If reviewing one folder at a time is preferred (to keep UX snappy):

```
## Step 4: Review Selected Folder

When user selects a folder (e.g., "Projects"):

4a. Get project IDs for selected folder only
4b. batch_filter_tasks for those projects (single call for folder)
4c. Present first project with fetched data
4d. Continue through folder using cached data
```

This batches by folder rather than all at once, which may feel more responsive.

#### batch_filter_tasks Usage

```javascript
// Example call structure
batch_filter_tasks({
  queries: [
    {projectId: "proj1", taskStatus: ["Available", "Next", "Blocked", "Overdue"]},
    {projectId: "proj2", taskStatus: ["Available", "Next", "Blocked", "Overdue"]},
    {projectId: "proj3", taskStatus: ["Available", "Next", "Blocked", "Overdue"]}
  ]
})

// Response structure
{
  "results": [
    {"projectId": "proj1", "tasks": [...], "totalCount": 5},
    {"projectId": "proj2", "tasks": [...], "totalCount": 3},
    {"projectId": "proj3", "tasks": [...], "totalCount": 8}
  ]
}
```

---

## 3. omnifocus-audit Optimization

### Current Issue

**Step 8** makes multiple sequential `filter_tasks` calls for tag analysis:

```
filter_tasks with tagFilter for review month → count per tag
```

For ~15-20 action tags, this is 15-20 sequential API calls.

### Performance Impact

- **Current**: N API calls for N tags (sequential)
- **After fix**: 1 API call (batched)
- **Savings**: For 15 tags: ~20-30 seconds → ~2-3 seconds

### Implementation Plan

#### Step 8 Change: Batch Tag Queries

**Current Step 8:**
```
Tag categories:
- Meta/PARA: project, area, resource, archive
- Action: read, listen, watch, create, dev, diy, go, learn, purchase, research, think
- Status: guidance, routine, actions, admin, focus

filter_tasks with tagFilter for review month → count per tag → TAG_DATA
```

**Updated Step 8:**
```
## Step 8: Gather Tag Data (Batched)

Define tag lists:
ACTION_TAGS = ["read", "listen", "watch", "create", "dev", "diy", "go", "learn", "purchase", "research", "think"]
STATUS_TAGS = ["guidance", "routine", "actions", "admin", "focus"]
ALL_TAGS = [...ACTION_TAGS, ...STATUS_TAGS]

Single batch call:
batch_filter_tasks({
  queries: ALL_TAGS.map(tag => ({
    tagFilter: tag,
    completedAfter: REVIEW_MONTH_START,
    completedBefore: REVIEW_MONTH_END,
    taskStatus: ["Completed"]
  }))
})

→ TAG_DATA = Map of tag → completion count

Build output table from TAG_DATA.
```

#### Enhanced Analysis with New Features

Can also add untagged task detection:

```
// Add to batch query
{
  untagged: true,
  taskStatus: ["Available", "Next"],
  completedAfter: REVIEW_MONTH_START,
  completedBefore: REVIEW_MONTH_END
}

→ UNTAGGED_COUNT = tasks without proper categorization
```

#### batch_filter_tasks Usage

```javascript
// Example call
batch_filter_tasks({
  queries: [
    {tagFilter: "read", completedAfter: "2026-01-01", completedBefore: "2026-01-31", taskStatus: ["Completed"]},
    {tagFilter: "dev", completedAfter: "2026-01-01", completedBefore: "2026-01-31", taskStatus: ["Completed"]},
    {tagFilter: "learn", completedAfter: "2026-01-01", completedBefore: "2026-01-31", taskStatus: ["Completed"]},
    // ... all tags
  ]
})

// Response
{
  "results": [
    {"query": {...}, "tasks": [...], "totalCount": 12},
    {"query": {...}, "tasks": [...], "totalCount": 8},
    {"query": {...}, "tasks": [...], "totalCount": 3}
  ]
}
```

---

## Summary

| Skill | Change | API Calls Before | API Calls After | Time Saved |
|-------|--------|------------------|-----------------|------------|
| reset-habits | Use batch response IDs | 3 extra | 0 extra | ~1-2s |
| project-review | batch_filter_tasks | 2N (N=projects) | 2 | ~30-60s for 20 projects |
| omnifocus-audit | batch_filter_tasks | N (N=tags) | 1 | ~20-30s for 15 tags |

---

## Testing Recommendations

1. **reset-habits**: Run `/today` and verify habits are created with correct parent-child relationships
2. **project-review**: Review a folder with 5+ projects, verify all task lists load correctly
3. **omnifocus-audit**: Run full audit, verify tag counts match individual queries

---

*Generated for seshat skill optimization - of-mcp v1.26.0*
