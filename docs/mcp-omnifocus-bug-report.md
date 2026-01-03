# OmniFocus MCP Server Bug Report: Task Name Matching Issues

## Summary
Task operations using `name` parameter fail for tasks containing special characters, and the `get_inbox_tasks` endpoint doesn't return task IDs, making it impossible to use the more reliable `id` parameter.

## Environment
- MCP Server: mcp-omnifocus (jqlts1/omnifocus-mcp-enhanced)
- Date: 2026-01-03

## Issues

### Issue 1: `get_inbox_tasks` doesn't return task IDs

**Current behavior:**
```
📥 Found 16 tasks in inbox:

1. Order Boker's Bitters
2. 🚩 note property tax due date...
```

**Expected behavior:**
```
📥 Found 16 tasks in inbox:

1. Order Boker's Bitters [ID: abc123]
2. 🚩 note property tax due date... [ID: def456]
```

**Impact:** Without IDs, users must rely on name matching, which is unreliable (see Issue 2).

---

### Issue 2: Name matching fails on special characters

**Affected characters:**
- Curly apostrophes: `'` (U+2019) vs straight `'` (U+0027)
- Accented characters: `é`, `ó`, `ñ`
- Emojis: `🚩`
- Long/complex punctuation sequences

**Example failures:**

| Task Name | Result |
|-----------|--------|
| `Order Boker's Bitters` | Task not found |
| `Buy Tempus Fugit Kina L'Aéro d'Or...` | Task not found |
| `🚩 note property tax due date...` | Task not found |
| `'A climate of unparalleled malevolence'...` | Task not found |

**Workaround attempted:**
- `get_task_by_id` with `taskName` parameter - same failure
- Partial name matching - not supported

---

### Issue 3: `filter_tasks` with `inInbox: true` returns wrong results

**Current behavior:**
Returns tasks from projects that have an "inbox-old" tag, not tasks actually in the Inbox perspective.

**Expected behavior:**
Should return tasks that appear in OmniFocus's Inbox perspective (unassigned tasks).

---

## Suggested Fixes

### Priority 1: Add task IDs to `get_inbox_tasks` output
This would allow reliable task operations regardless of name complexity.

### Priority 2: Normalize Unicode in name matching
- Normalize curly quotes to straight quotes before comparison
- Use Unicode normalization (NFD/NFC) for accented characters
- Strip or handle emojis gracefully

### Priority 3: Fix `inInbox` filter logic
Ensure it matches the actual Inbox perspective behavior, not tag-based filtering.

---

## Reproduction Steps

1. Create a task in OmniFocus with a curly apostrophe: `Test task with curly quote'`
2. Call `get_inbox_tasks` - note no ID is returned
3. Call `edit_item` with `name: "Test task with curly quote'"` (straight apostrophe)
4. Observe: "Task not found" error

---

## Workaround (Current)
For tasks with special characters, users must manually edit them in OmniFocus directly.
