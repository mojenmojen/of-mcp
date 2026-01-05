# Bug Report: get_projects_for_review Returns Dropped Projects with Wrong Status

## Summary
The `get_projects_for_review` function returns dropped projects in its results and incorrectly reports their status as "OnHold" instead of "Dropped".

## Severity
**High** - This function is unusable for its intended purpose (finding projects that need review) because it returns false positives and misreports status.

## Steps to Reproduce

1. Have a project that is **Dropped** (either directly or via dropped container/folder)
2. Call `get_projects_for_review` with `includeOnHold: true`
3. Observe that dropped projects appear in results with `Status: OnHold`

## Expected Behavior

- Dropped projects should **NOT** appear in the results at all (they don't need review)
- If a project's container is dropped, the project should be treated as dropped
- Only Active and OnHold projects should be returned
- Status field should accurately reflect the project's actual status

## Actual Behavior

- Dropped projects ARE returned in results
- Their status is incorrectly reported as "OnHold"
- Projects with dropped containers are included

## Evidence

### Test Case: "skating lessons" project (ID: bnWsoATC-lj)

**OmniFocus UI shows**: "Dropped with container"

**get_projects_for_review returned**:
```
**skating lessons** (ID: bnWsoATC-lj)
  • Status: OnHold        <-- WRONG
  • Remaining Tasks: 0
  • Review Interval: 7 days
  • Next Review: 2016-06-24T07:00:00.000Z
  • Last Reviewed: 2014-08-17T16:56:40.970Z
```

**filter_tasks with taskStatus: ["Dropped"] returned**:
```
⚫ skating lessons [ID: bnWsoATC-lj] (Dropped)   <-- CORRECT
```

### Additional Affected Projects (all returned as "OnHold", all actually Dropped):
- website ownership (ID: n_ut2EUPL0n)
- web committee setup (ID: g0aU5JZSuG8)
- membership (ID: eDd7KJpFPYU)
- website updates (ID: epe1XE75OMK)
- administer parents trust (ID: oDbte-bk5_0)
- write dad's memoirs (ID: crof81w7IhM)
- write mother's memoirs (ID: awbAFzS6Fh5)
- website - deliberate work (ID: nQR6oULn4os)

All 9 projects returned by `get_projects_for_review` were actually Dropped.

## Potential Root Cause

The function likely:
1. Queries projects where `nextReviewDate <= today`
2. Checks `project.status` directly without checking if the project (or its container) is dropped
3. May be using an incorrect status mapping or not checking the effective status

### JXA Context
In OmniFocus JXA:
- `project.status` returns the project's own status
- `project.effectiveStatus` or checking `project.dropped` may be needed
- A project inside a dropped folder inherits dropped status ("dropped with container")

## Suggested Fix

1. **Filter out dropped projects**:
   ```javascript
   // Check both direct status and container status
   if (project.dropped || project.status === 'dropped') {
     continue; // Skip this project
   }
   ```

2. **Check effective status** if available:
   ```javascript
   const effectiveStatus = project.effectiveStatus || project.status;
   ```

3. **Accurately report status** in the response:
   - Use the actual status value, not a hardcoded or incorrectly mapped value

## Workaround

Until fixed, use `filter_tasks` with appropriate status filters instead of `get_projects_for_review`:
```javascript
filter_tasks({
  taskStatus: ["Available", "Next", "Blocked"],
  // Additional filtering needed for review date
})
```

However, this doesn't provide the `nextReviewDate` filtering that `get_projects_for_review` should handle.

## Environment
- OmniFocus MCP Server (version unknown - suggest adding `get_server_version` check)
- macOS
- OmniFocus 4

## Related
- The `get_project_by_id` function also reports incorrect status for these projects (shows "OnHold" for dropped projects)
- This may indicate a shared status-mapping issue across multiple functions
