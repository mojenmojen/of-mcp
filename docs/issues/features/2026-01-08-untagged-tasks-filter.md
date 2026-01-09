# Feature Request: Filter for Untagged Tasks

**Date:** 2026-01-08
**Priority:** Medium

## Summary

Add the ability to filter for tasks that have no tags assigned. This would mirror the "Untagged" filter available in the OmniFocus native UI.

## Use Case

When performing tag cleanup or auditing task organization, users need to identify tasks that have no tags. Currently there's no way to query for untagged tasks via the MCP - you can filter BY tag, but not for the ABSENCE of tags.

Example scenario: After bulk-removing obsolete tags (like PARA focus tags being replaced with action tags), users need to find tasks that were left without any tags so they can assign appropriate ones.

## Proposed Implementation

### Option A: New parameter on `filter_tasks`

Add a boolean parameter `untagged`:

```json
{
  "untagged": true,
  "taskStatus": ["Available", "Next", "Blocked"]
}
```

### Option B: Special value for `tagFilter`

Allow a special value like `"none"` or `null` for tagFilter:

```json
{
  "tagFilter": "none"
}
```

### Option C: Dedicated tool

Create `get_untagged_tasks` tool with standard filtering options:

```json
{
  "taskStatus": ["Available", "Next", "Blocked"],
  "projectFilter": "mixology",
  "limit": 100
}
```

## Recommendation

Option A (parameter on `filter_tasks`) seems most consistent with the existing API design and keeps the tool count manageable.

## Related

- OmniFocus native UI has "Untagged" in the Tags perspective sidebar
- Useful for tag hygiene and GTD maintenance workflows
