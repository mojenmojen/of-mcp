# P00A: Execution Timeout

## Priority: Critical (P0 - Pre-work)
## Effort: Low (30 minutes)
## Category: Infrastructure Reliability

---

## Problem Statement

The current `executeOmniFocusScript` function in `scriptExecution.ts` has no execution timeout. The `EXEC_OPTIONS` only specifies `maxBuffer` without any timeout:

```typescript
const EXEC_OPTIONS = { maxBuffer: 50 * 1024 * 1024 };
```

This means that if OmniFocus hangs, freezes, or a script enters an infinite loop, the MCP server will hang indefinitely. This is especially problematic:

1. **User experience** - AI assistant appears frozen with no feedback
2. **Resource leak** - Process remains blocked holding resources
3. **No recovery** - Only solution is to kill the server process manually

---

## Proposed Solution

Add a configurable timeout to script execution with sensible defaults.

---

## Files to Modify

### `src/utils/scriptExecution.ts`

Update `EXEC_OPTIONS` to include a timeout:

```typescript
const EXEC_OPTIONS = {
  maxBuffer: 50 * 1024 * 1024,
  timeout: 30000  // 30 seconds - generous for large databases
};
```

### Error Handling

When a timeout occurs, the subprocess will be killed. Update error handling to detect this:

```typescript
} catch (error: any) {
  // Check for timeout (subprocess killed after timeout)
  if (error.killed && error.signal === 'SIGTERM') {
    console.error("Script execution timed out after 30 seconds");
    throw new Error('Script execution timed out. OmniFocus may be unresponsive.');
  }

  console.error("Failed to execute OmniFocus script:", error);
  throw error;
}
```

---

## Implementation Notes

- 30 seconds is generous - most scripts complete in 1-5 seconds
- Larger databases may need 10-15 seconds for complex filters
- Timeout should be configurable via environment variable in future
- This is a prerequisite for structured error responses (002) - ensures we can categorize timeout errors

---

## Why This Is P0 Pre-work

1. **Required for 002 (Structured Errors)** - Need to categorize timeout as specific error type
2. **Low risk** - Simple 1-line change with high impact
3. **Immediate reliability benefit** - Prevents server hangs today
4. **No breaking changes** - Existing scripts won't notice (they complete in under 10s)

---

## Acceptance Criteria

- [ ] `EXEC_OPTIONS` includes `timeout: 30000`
- [ ] Timeout errors throw descriptive error message
- [ ] Normal script execution unaffected
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "JXA Bridge Architecture" section mentions timeout/retry patterns
- Node.js child_process documentation: timeout option
