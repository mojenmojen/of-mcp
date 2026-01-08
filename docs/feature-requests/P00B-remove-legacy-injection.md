# P00B: Remove Legacy Parameter Injection

## Priority: Critical (P0 - Pre-work)
## Effort: Low (1 hour)
## Category: Infrastructure Cleanup

---

## Problem Statement

The `scriptExecution.ts` file contains legacy regex-based parameter injection code (lines 109-141) that is:

1. **Brittle** - Relies on exact string matching like `let perspectiveName = ".*"; // Hardcode for testing`
2. **Unnecessary** - The universal `injectedArgs` pattern at lines 97-107 already handles all parameters
3. **Confusing** - Two different injection mechanisms makes the code hard to reason about
4. **Risky** - Modifying this file for structured errors (002) becomes harder with legacy code

Current brittle regex patterns:

```typescript
// These are fragile and unnecessary
scriptContent = scriptContent.replace(
  /let perspectiveName = ".*"; \/\/ (?:Hardcode for testing|Default for testing)/,
  'let perspectiveName = injectedArgs.perspectiveName || null;'
);
scriptContent = scriptContent.replace(
  /let perspectiveName = null;/,
  'let perspectiveName = injectedArgs.perspectiveName || null;'
);
// ... 6 more similar patterns
```

All scripts already use `injectedArgs` correctly:

```javascript
const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
const perspectiveName = args.perspectiveName || null;
```

---

## Proposed Solution

Remove the legacy regex patterns and rely solely on `injectedArgs`.

---

## Files to Modify

### `src/utils/scriptExecution.ts`

**Remove lines 109-141** (the regex replacement block):

```typescript
// DELETE THIS ENTIRE BLOCK:
// Replace any hardcoded parameters in the script with injected ones
scriptContent = scriptContent.replace(
  /let perspectiveName = ".*"; \/\/ (?:Hardcode for testing|Default for testing)/,
  'let perspectiveName = injectedArgs.perspectiveName || null;'
);
// ... all the other regex replaces ...
```

**Keep the universal injection** (lines 97-107):

```typescript
const parameterInjection = `
// Injected parameters
const injectedArgs = ${argsJson};
const perspectiveName = injectedArgs.perspectiveName || null;
// ...
`;
```

### OmniJS Scripts (if any still have legacy patterns)

Audit and update any scripts that still use the old pattern:

```javascript
// OLD (fragile):
let perspectiveName = null;  // Will be replaced by regex

// NEW (robust):
const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
const perspectiveName = args.perspectiveName || null;
```

---

## Implementation Notes

- Most scripts already use the new `injectedArgs` pattern correctly
- The regex patterns were a transitional mechanism during early development
- Removing them simplifies the codebase and makes future changes safer
- This cleanup makes 002 (Structured Errors) easier to implement

---

## Why This Is P0 Pre-work

1. **Required for 002** - Modifying scriptExecution.ts is risky with legacy code present
2. **Reduces complexity** - One parameter mechanism instead of two
3. **No breaking changes** - Scripts already use injectedArgs
4. **Technical debt** - Clear cleanup with measurable benefit

---

## Acceptance Criteria

- [ ] Lines 109-141 removed from scriptExecution.ts
- [ ] All OmniJS scripts verified to use injectedArgs pattern
- [ ] All existing tools still work correctly
- [ ] Build passes
- [ ] Version bump in package.json

---

## Verification

Test these tools after cleanup:

1. `list_custom_perspectives` - uses perspectiveName
2. `get_custom_perspective_tasks` - uses perspectiveId, hideCompleted, limit
3. Any tool that uses the perspective parameters

---

## References

- scriptExecution.ts lines 97-148 (current parameter injection)
- PERFORMANCE_AND_PATTERNS.md: "Three-Tier Script Architecture" section
