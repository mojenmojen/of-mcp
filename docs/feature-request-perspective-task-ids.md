# Feature Request: Include Task IDs in Perspective Output

## Summary
`get_custom_perspective_tasks` should return task IDs in the output so deep links can be constructed without additional queries.

## Current Behaviour
```
**Perspective Tasks: Dashboard** (46 tasks)

1. **align goals, tasks and omnifocus**
   Tags: routine
   Note: Seshat
```

Task IDs are not included in the output.

## Desired Behaviour
```
**Perspective Tasks: Dashboard** (46 tasks)

1. **align goals, tasks and omnifocus** [ID: abc123xyz]
   Tags: routine
   Note: Seshat
```

Or in a more link-friendly format:
```
1. **align goals, tasks and omnifocus**
   ID: abc123xyz
   Tags: routine
```

## Use Case
The `energy-tasks` skill needs to:
1. Pull tasks from Dashboard perspective
2. Group them by energy level
3. Insert into daily note with clickable `omnifocus:///task/{taskID}` links

Without IDs in the perspective output, we must make N additional `get_task_by_id` queries (one per task) to retrieve IDs - inefficient and slow.

## Affected Tools
- `get_custom_perspective_tasks` (primary)
- Possibly also beneficial for:
  - `get_forecast_tasks`
  - `get_flagged_tasks`
  - `get_inbox_tasks`
  - `get_tasks_by_tag`
  - `filter_tasks`

## Priority
Medium-high - blocks efficient implementation of energy-tasks skill.

## Workaround
Query each task by name using `get_task_by_id(taskName: "...")` - works but requires N API calls.
