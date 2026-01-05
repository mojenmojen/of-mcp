# Feature Request: Mark Project as Reviewed

## Summary

Add the ability to mark projects as "reviewed" via the MCP server, advancing their next review date according to their review interval.

## Background

OmniFocus has a built-in Review system where:
- Each project has a **review interval** (e.g., every 7 days, every 30 days)
- Each project has a **next review date**
- The Review perspective shows projects whose next review date has passed
- When a user marks a project as "reviewed," the next review date advances by the interval

Currently, the MCP can read project data and modify status (active, on hold, completed, dropped) but cannot interact with the review system.

## Use Case

During a weekly review workflow:
1. AI assistant pulls projects needing review
2. User triages each project (still relevant? needs action? put on hold?)
3. AI applies any status changes
4. AI marks projects as reviewed (advancing next review date)
5. User completes review without manually clicking through OmniFocus

Without this feature, step 4 requires manual intervention in OmniFocus.

## Proposed API

### Option A: Add to `edit_item`

Extend the existing `edit_item` tool with review-related parameters:

```javascript
edit_item({
  itemType: "project",
  id: "abc123",
  markReviewed: true,           // Advances next review date by interval
  newReviewInterval: 604800     // Optional: change interval (seconds)
                                // 604800 = 7 days
})
```

### Option B: Dedicated tool

Create a new `mark_reviewed` tool:

```javascript
mark_reviewed({
  projectId: "abc123",          // Required: project ID
  // OR
  projectName: "My Project",    // Alternative: lookup by name

  advanceBy: "interval",        // Default: advance by project's review interval
  // OR
  advanceBy: "custom",
  customDays: 30                // Advance by specific number of days
})
```

### Option C: Batch operation

For efficiency during weekly reviews, support batch marking:

```javascript
batch_mark_reviewed({
  projectIds: ["abc123", "def456", "ghi789"],
  advanceBy: "interval"         // All advance by their own intervals
})
```

## Data Model

OmniFocus project review properties (for reference):

| Property | Type | Description |
|----------|------|-------------|
| `reviewInterval` | Number (seconds) | Time between reviews |
| `nextReviewDate` | Date | When project next appears in Review |
| `lastReviewDate` | Date | When project was last reviewed |

## Implementation Notes

### JXA/AppleScript Access

OmniFocus exposes review properties via its scripting interface:

```javascript
// Get review info
project.reviewInterval        // seconds
project.nextReviewDate        // Date object

// Mark as reviewed (advances next review date)
project.markReviewed()

// Alternatively, set next review date directly
project.nextReviewDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
```

### Considerations

1. **Projects only** - Tasks don't have review dates; only projects do
2. **Review interval preservation** - Marking reviewed should use the project's existing interval unless explicitly overridden
3. **Paused projects** - On Hold projects can still be reviewed; status and review are independent
4. **Bulk efficiency** - Weekly reviews may involve 20-50+ projects; batch operation is valuable

## Related Features

Once review marking is supported, additional enhancements become possible:

1. **Get projects needing review** - Filter/perspective that returns projects where `nextReviewDate <= now`
2. **Set review interval** - Ability to change how often a project comes up for review
3. **Review statistics** - Track review patterns over time

## Priority

Medium-high. This completes the weekly review workflow automation and addresses a common friction point in GTD practice.

## References

- OmniFocus Scripting Documentation: Review properties
- GTD Weekly Review: Project review is a core component
