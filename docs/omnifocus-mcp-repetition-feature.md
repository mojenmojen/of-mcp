# Feature Request: Repetition/Recurrence Support for OmniFocus MCP

## Summary

Add the ability to create and modify repeating tasks via the OmniFocus MCP server.

## Current State

Neither `add_omnifocus_task` nor `edit_item` supports setting repetition rules. Users must manually configure task repetition in OmniFocus after creation via MCP.

## Requirements

### 1. Add Repetition to `add_omnifocus_task`

Add a `repetitionRule` parameter (optional) with the following structure:

```typescript
repetitionRule?: {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;           // e.g., 2 = every 2 weeks (default: 1)
  daysOfWeek?: number[];       // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  dayOfMonth?: number;         // 1-31 (for monthly)
  month?: number;              // 1-12 (for yearly)
  repeatFrom?: 'due' | 'completion';  // OmniFocus-specific: repeat from due date or completion date
}
```

### 2. Add Repetition to `edit_item`

Add corresponding `newRepetitionRule` parameter to modify existing tasks:
- Setting a rule on a non-repeating task makes it repeat
- Setting to `null` or empty object removes repetition

### 3. Expose Repetition in Task Output

When retrieving tasks (via `filter_tasks`, `get_task_by_id`, etc.), include the repetition rule in the response so users can see current repeat settings.

## Example Usage

### Creating a weekly repeating task:
```json
{
  "name": "Review inbox-old archive",
  "projectName": "Personal Productivity",
  "estimatedMinutes": 15,
  "repetitionRule": {
    "frequency": "weekly",
    "interval": 1,
    "repeatFrom": "completion"
  }
}
```

### Creating a task that repeats every Monday and Thursday:
```json
{
  "name": "Morning exercise",
  "repetitionRule": {
    "frequency": "weekly",
    "interval": 1,
    "daysOfWeek": [1, 4],
    "repeatFrom": "due"
  }
}
```

## OmniFocus Repetition Behaviour

OmniFocus has two repetition modes that should be supported:

1. **Repeat from due date** - Next occurrence is calculated from the due date, regardless of when completed
2. **Repeat from completion** - Next occurrence is calculated from when the task was actually completed

Both modes are commonly used and should be configurable.

## References

- OmniFocus Automation documentation for repetition rules
- Existing MCP server source: `src/utils/omnifocusScripts/`
