# Feature: Focus Mode Handling for Custom Perspective Queries

**Status:** Planned for future sprint
**Priority:** Medium
**Created:** 2025-01-11

## Problem

When OmniFocus Focus mode is active, perspective queries return only focused items. AI assistants have no visibility into this - they think they're seeing the full picture but are actually getting filtered data.

## Solution

Add an `ignoreFocus` parameter (default: `true`) to perspective queries so AI assistants get complete data by default. Include Focus metadata in responses so users know when Focus was active.

## Files to Modify

| File | Changes |
|------|---------|
| `src/tools/definitions/getCustomPerspectiveTasks.ts` | Add `ignoreFocus` parameter to schema |
| `src/tools/primitives/getCustomPerspectiveTasks.ts` | Pass `ignoreFocus` to script, include focus metadata in output |
| `src/utils/omnifocusScripts/getCustomPerspectiveTasks.js` | Detect Focus, optionally clear it, return focus metadata |
| `src/utils/scriptExecution.ts` | Add `ignoreFocus` to parameter injection |
| `package.json` | Bump version to 1.28.0 (new feature) |
| `docs/WHATS_NEW.md` | Document the new parameter |

## Implementation Steps

### Step 1: Modify OmniJS Script (`getCustomPerspectiveTasks.js`)

Add Focus detection and handling at the start of the script:

```javascript
// Get Focus state BEFORE any operations
const originalFocus = document.focus;
const focusWasActive = originalFocus !== null;
const focusTarget = focusWasActive ? {
  name: originalFocus.name,
  type: originalFocus instanceof Project ? "project" :
        originalFocus instanceof Folder ? "folder" :
        originalFocus instanceof Tag ? "tag" : "unknown"
} : null;

// Clear Focus if ignoreFocus is true (default)
const ignoreFocus = injectedArgs && injectedArgs.ignoreFocus !== undefined
  ? injectedArgs.ignoreFocus
  : true;  // Default to true

if (ignoreFocus && focusWasActive) {
  document.focus = null;
}
```

Add focus metadata to response:

```javascript
const result = {
  success: true,
  perspectiveName: perspective.name,
  perspectiveId: perspective.identifier,
  count: taskCount,
  taskMap: taskMap,
  // NEW: Focus metadata
  focus: {
    wasActive: focusWasActive,
    cleared: ignoreFocus && focusWasActive,
    target: focusTarget
  }
};
```

### Step 2: Update Tool Definition (`getCustomPerspectiveTasks.ts`)

Add to Zod schema:

```typescript
ignoreFocus: z.boolean()
  .optional()
  .default(true)
  .describe("When true (default), clears Focus mode to return all tasks. When false, respects current Focus and returns only focused tasks.")
```

Pass to handler:

```typescript
const result = await getCustomPerspectiveTasks({
  // ...existing params...
  ignoreFocus: args.ignoreFocus !== false  // Default true
});
```

### Step 3: Update Primitive (`getCustomPerspectiveTasks.ts`)

Pass parameter to script:

```typescript
const result = await executeOmniFocusScript('@getCustomPerspectiveTasks.js', {
  perspectiveName,
  perspectiveId,
  ignoreFocus  // NEW
});
```

Include focus info in output header:

```typescript
let output = `**Perspective Tasks: ${perspectiveName}** (${taskCount} tasks)\n`;

// Add focus warning if it was active
if (data.focus?.wasActive) {
  if (data.focus.cleared) {
    output += `> Focus mode was active on "${data.focus.target?.name}" - temporarily cleared for complete results\n`;
  } else {
    output += `> **Focus mode active** on "${data.focus.target?.name}" - showing filtered results only\n`;
  }
}
output += '\n';
```

### Step 4: Update Script Execution (`scriptExecution.ts`)

Add to parameter injection (around line 120):

```typescript
const ignoreFocus = injectedArgs.ignoreFocus !== undefined ? injectedArgs.ignoreFocus : true;
```

### Step 5: Version & Docs

- Bump `package.json` version to `1.28.0` (minor - new feature)
- Update `docs/WHATS_NEW.md` with:
  - New `ignoreFocus` parameter documentation
  - Explanation of Focus mode behavior
  - Examples

## Verification

1. **Build**: `npm run build` - should complete without errors
2. **Test with Focus OFF**:
   - Set Focus to a project in OmniFocus
   - Call `get_custom_perspective_tasks` with a perspective
   - Verify response includes `> Focus mode was active...cleared` message
   - Verify all tasks are returned (not just focused ones)
3. **Test with Focus ON** (`ignoreFocus: false`):
   - Set Focus to a project in OmniFocus
   - Call `get_custom_perspective_tasks` with `ignoreFocus: false`
   - Verify response shows warning about filtered results
   - Verify only focused tasks are returned
4. **Test with no Focus**:
   - Clear Focus in OmniFocus
   - Call `get_custom_perspective_tasks`
   - Verify no focus message appears
   - Verify normal task list returned

## API Example

```typescript
// Default behavior - ignores Focus, returns all tasks
get_custom_perspective_tasks({
  perspectiveName: "Dashboard"
})

// Explicit - respect Focus mode
get_custom_perspective_tasks({
  perspectiveName: "Dashboard",
  ignoreFocus: false
})
```

## Response Example

When Focus was active and cleared:
```
**Perspective Tasks: Dashboard** (47 tasks)
> Focus mode was active on "Work Projects" - temporarily cleared for complete results

1. **Task Name** [ID: abc123]
   ...
```
