# Fix: OmniFocus MCP Cannot Complete Tasks

## Problem

When attempting to mark a task as complete via the MCP server, the following error is returned:

```
OmniFocus got an error: Can't set completed of inbox task to true.
```

This occurs even though completing tasks works fine in the OmniFocus UI.

## Root Cause

OmniFocus changed their AppleScript API. The `completed` property is now **read-only** and cannot be set directly.

**Source:** https://support.omnigroup.com/omnifocus-applescript-changes/

> The `completed` property is now read-only. In order to mark a task or project complete or incomplete, new verbs for `mark complete` and `mark incomplete` should be used.

## Current Code (Broken)

File: `src/tools/primitives/editItem.ts`

Lines 171-190:

```typescript
if (params.newStatus === 'completed') {
  script += `
        -- Mark task as completed
        set completed of foundItem to true
        set end of changedProperties to "status (completed)"
`;
} else if (params.newStatus === 'dropped') {
  script += `
        -- Mark task as dropped
        set dropped of foundItem to true
        set end of changedProperties to "status (dropped)"
`;
} else if (params.newStatus === 'incomplete') {
  script += `
        -- Mark task as incomplete
        set completed of foundItem to false
        set dropped of foundItem to false
        set end of changedProperties to "status (incomplete)"
`;
}
```

## Required Fix

Replace the property assignments with the appropriate AppleScript verbs:

```typescript
if (params.newStatus === 'completed') {
  script += `
        -- Mark task as completed
        mark complete foundItem
        set end of changedProperties to "status (completed)"
`;
} else if (params.newStatus === 'dropped') {
  script += `
        -- Mark task as dropped
        mark dropped foundItem
        set end of changedProperties to "status (dropped)"
`;
} else if (params.newStatus === 'incomplete') {
  script += `
        -- Mark task as incomplete
        mark incomplete foundItem
        set end of changedProperties to "status (incomplete)"
`;
}
```

## Summary of Changes

| Status | Old (Broken) | New (Fixed) |
|--------|--------------|-------------|
| completed | `set completed of foundItem to true` | `mark complete foundItem` |
| dropped | `set dropped of foundItem to true` | `mark dropped foundItem` |
| incomplete | `set completed of foundItem to false` + `set dropped of foundItem to false` | `mark incomplete foundItem` |

## After Fixing

1. Rebuild the project: `npm run build`
2. Test completing an inbox task
3. Test completing a project task
4. Verify the fix works for all three status changes (completed, dropped, incomplete)

## Test Task

For testing, use the inbox task:
- **Name:** "add omnifocus mcp server to seshat"
- **ID:** `f11ZFKswPon`
