# Bug Report: Incorrect `totalCount` in filter_tasks Output

**Date:** 2026-01-04
**Reporter:** Seshat (via MoJen)
**Severity:** Low (cosmetic/misleading output)
**Component:** `filter_tasks` tool

## Summary

The `filter_tasks` tool reports an incorrect `totalCount` value, showing the count of *all* tasks in the database rather than the count of tasks matching the filter criteria.

## Steps to Reproduce

1. Call `filter_tasks` with a project filter:
   ```json
   {
     "projectFilter": "inbox-old",
     "limit": 100
   }
   ```

2. Observe the output:
   ```
   Found 532 tasks (showing first 532 of 4369)
   ```

3. Verify in OmniFocus UI that the project contains ~531 tasks, not 4369.

## Expected Behavior

Output should read:
```
Found 532 tasks
```

Or if a limit was actually applied:
```
Found 100 tasks (showing first 100 of 532)
```

## Actual Behavior

Output shows total database task count (4369) instead of filtered result count (532).

## Root Cause

**File:** `src/utils/omnifocusScripts/filterTasks.js`
**Line:** 207

```javascript
const exportData = {
  // ...
  totalCount: baseTasks.length,  // BUG: This is pre-filter count
  // ...
};
```

### Code Flow Analysis

1. **Line 70:** `allTasks = flattenedTasks` - Gets ALL tasks in database
2. **Lines 80-88:** `availableTasks` - Filters out completed/dropped tasks
3. **Lines 91-102:** `baseTasks` - Set based on perspective:
   - For `perspective: "all"` (default), `baseTasks = availableTasks` (~4369 tasks)
4. **Lines 105-179:** `filteredTasks` - Applies all filters including `projectFilter`
5. **Lines 199-201:** `filteredTasks` is sliced to `limit`
6. **Line 207:** `totalCount: baseTasks.length` reports 4369, not 532

## Suggested Fix

Capture the filtered count *after* all filters but *before* the limit is applied:

```javascript
// After line 179 (all filters applied):
const totalMatchingCount = filteredTasks.length;

// Lines 199-201 (limit applied):
if (filters.limit && filteredTasks.length > filters.limit) {
  filteredTasks = filteredTasks.slice(0, filters.limit);
}

// Line 207 in exportData:
totalCount: totalMatchingCount,  // Changed from baseTasks.length
```

## Impact

- **User confusion:** Users may think their filter isn't working correctly
- **Misleading counts:** The "X of Y" format implies pagination when it's actually showing incorrect totals
- **No data loss:** This is purely a display/reporting issue; actual filtered results are correct

## Additional Notes

The TypeScript wrapper in `src/tools/primitives/filterTasks.ts` (lines 110-116) correctly handles the display logic - it only shows "showing first X of Y" when `taskCount < totalCount`. The fix needs to be in the JXA script that provides the `totalCount` value.
