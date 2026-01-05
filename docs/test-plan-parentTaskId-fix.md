# Test Plan: parentTaskId Fix (v1.8.9)

## Summary
Test that `batch_add_items` with `parentTaskId` now correctly creates subtasks instead of siblings.

---

## Prerequisites
- OmniFocus running on macOS
- MCP server rebuilt and restarted with v1.8.9
- A test project exists (or create one called "Test Project")

---

## Test Cases

### Test 1: Create Parent Task
**Action:** Create a parent task using `batch_add_items`
```json
{
  "items": [{
    "type": "task",
    "name": "Parent Task Test",
    "projectName": "Test Project"
  }]
}
```

**Expected:** Task created successfully, note the returned task ID.

---

### Test 2: Get Parent Task ID
**Action:** Use `filter_tasks` to get the parent task ID
```json
{
  "searchText": "Parent Task Test",
  "projectFilter": "Test Project"
}
```

**Expected:** Returns task with ID like `[ID: abc123def]`

---

### Test 3: Create Child Tasks with parentTaskId
**Action:** Create child tasks using the parent's ID
```json
{
  "items": [
    {"type": "task", "name": "Child Task 1", "parentTaskId": "<ID_FROM_TEST_2>"},
    {"type": "task", "name": "Child Task 2", "parentTaskId": "<ID_FROM_TEST_2>"}
  ]
}
```

**Expected:**
- Success message returned
- Both tasks created

---

### Test 4: Verify Parent-Child Relationship
**Action:** Use `get_task_by_id` to check parent task
```json
{
  "taskName": "Parent Task Test"
}
```

**Expected:**
- `Has Children: Yes (2 subtasks)`

**Also verify in OmniFocus UI:**
- Open "Test Project"
- "Parent Task Test" should show disclosure triangle
- Expanding it should show "Child Task 1" and "Child Task 2" nested underneath

---

### Test 5: Create Child with parentTaskName (Alternative)
**Action:** Create another child using name instead of ID
```json
{
  "items": [{
    "type": "task",
    "name": "Child Task 3",
    "parentTaskName": "Parent Task Test"
  }]
}
```

**Expected:**
- Success message
- Task appears as child of "Parent Task Test" in OmniFocus
- `get_task_by_id` now shows `Has Children: Yes (3 subtasks)`

---

## Pass/Fail Criteria

| Test | Pass Criteria |
|------|--------------|
| 1 | Parent task created in project |
| 2 | Task ID returned in output |
| 3 | Success returned, no errors |
| 4 | `Has Children: Yes` AND visible in OmniFocus as nested |
| 5 | Child created as subtask, not sibling |

---

## Cleanup
After testing, delete "Parent Task Test" and its children from OmniFocus.

---

## Version Info
- **Fix Version:** 1.8.9
- **Commit:** 2d664cd
- **Fix:** Use `moveTasks()` instead of Task constructor for subtask creation
