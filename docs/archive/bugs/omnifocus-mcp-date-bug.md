# OmniFocus MCP Date Parsing Bug

## Summary
When using `batch_add_items` to create tasks with datetime values in ISO format, the dates are parsed incorrectly, resulting in dates from 2008 instead of 2026.

## Environment
- OmniFocus MCP Server (mcp-omnifocus)
- Tool: `mcp__mcp-omnifocus__batch_add_items`

## What I Tried

Created tasks using the following payload:

```json
{
  "items": [
    {
      "type": "task",
      "name": "morning",
      "projectName": "morning habits",
      "tags": ["routine"],
      "deferDate": "2026-01-03T03:00:00",
      "dueDate": "2026-01-03T08:00:00"
    },
    {
      "type": "task",
      "name": "evening",
      "projectName": "evening habits",
      "tags": ["routine"],
      "deferDate": "2026-01-03T20:00:00",
      "dueDate": "2026-01-03T23:00:00"
    }
  ]
}
```

## Expected Result
- Morning task: defer 2026-01-03 at 03:00, due 2026-01-03 at 08:00
- Evening task: defer 2026-01-03 at 20:00, due 2026-01-03 at 23:00

## Actual Result
Both tasks were created with:
- Defer date: 18/07/2008
- Due date: 18/07/2008

The time component appears to be lost entirely.

## Tool Documentation

From the MCP tool schema:

```
deferDate: "The defer date of the task in ISO format (YYYY-MM-DD or full ISO date)"
dueDate: "The due date of the task in ISO format (YYYY-MM-DD or full ISO date)"
```

## Workaround Found

Using `edit_item` with just the date (no time) works correctly:

```json
{
  "itemType": "task",
  "id": "ggFiY-P5MP2.1157.5.82.1.121.106.789",
  "newDeferDate": "2026-01-03",
  "newDueDate": "2026-01-03"
}
```

This correctly sets the date to 2026-01-03, but the time component is lost.

## Questions to Investigate

1. What is the correct ISO format for including time? Options to try:
   - `2026-01-03T03:00:00` (what I used)
   - `2026-01-03T03:00:00Z` (with UTC timezone)
   - `2026-01-03T03:00:00-08:00` (with PST timezone)
   - `2026-01-03 03:00:00` (space instead of T)

2. Why does `2026-01-03T03:00:00` parse as `18/07/2008`?
   - This is a very specific wrong date - there may be a numeric conversion bug

3. Does `edit_item` support time in `newDeferDate`/`newDueDate` parameters?

4. Is there a separate time field that should be used?

## Reproduction Steps

1. Use `mcp__mcp-omnifocus__batch_add_items` with items containing `deferDate` or `dueDate` in format `YYYY-MM-DDTHH:MM:SS`
2. Observe the created tasks in OmniFocus
3. Note that dates show as 2008 instead of 2026

## Additional Context

The date 18/07/2008 (or 07/18/2008 in US format) is suspicious. Converting the ISO string to a number or misinterpreting the format could produce this. For example:
- If "2026-01-03T03:00:00" is being parsed as a Unix timestamp or some other numeric format
- Or if the T and colons are causing parsing issues
