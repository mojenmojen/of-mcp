# 003: Retry Logic with Exponential Backoff

## Priority: High
## Effort: Medium (2-3 hours)
## Category: Infrastructure Improvement
## Dependencies: 002-structured-error-responses

---

## Problem Statement

Script execution can fail transiently for several reasons:
- OmniFocus briefly busy (syncing, processing)
- System resources temporarily constrained
- Application restart in progress

Currently, any failure is immediately returned to the user. For transient errors, automatic retry would provide a better experience.

---

## Proposed Solution

Add retry logic with exponential backoff to `scriptExecution.ts`:
1. Retry on specific error types (app_unavailable, some script errors)
2. Use exponential backoff (1s, 2s, 4s)
3. Maximum 3 retry attempts
4. Don't retry on permission errors (those require user action)

---

## Files to Modify

### `src/utils/scriptExecution.ts`

```typescript
import { categorizeError, StructuredError, ErrorCodes } from './errors.js';

// Configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const RETRYABLE_ERROR_TYPES = ['app_unavailable'];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(error: StructuredError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  return RETRYABLE_ERROR_TYPES.includes(error.error.type);
}

export async function executeOmniFocusScript(
  scriptPath: string,
  args?: any,
  retryCount = 0
): Promise<any> {
  try {
    // ... existing script preparation code ...

    const { stdout, stderr } = await execAsync(
      `osascript -l JavaScript ${tempFile}`,
      EXEC_OPTIONS
    );

    // Clean up
    unlinkSync(tempFile);

    // ... existing parsing code ...

  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (tempFile) unlinkSync(tempFile);
    } catch {}

    const structuredError = categorizeError(error);

    // Check if we should retry
    if (shouldRetry(structuredError, retryCount)) {
      const delayMs = INITIAL_DELAY_MS * Math.pow(2, retryCount);
      console.error(
        `[RETRY] Attempt ${retryCount + 1}/${MAX_RETRIES} failed, ` +
        `retrying in ${delayMs}ms: ${structuredError.error.message}`
      );

      await delay(delayMs);
      return executeOmniFocusScript(scriptPath, args, retryCount + 1);
    }

    // Log final failure
    console.error(
      `[ERROR] ${structuredError.error.code}: ${structuredError.error.message}` +
      (retryCount > 0 ? ` (after ${retryCount} retries)` : '')
    );

    throw structuredError;
  }
}
```

---

## Implementation Notes

- Only retry on errors that might be transient
- Never retry permission errors (user must fix)
- Never retry validation errors (input won't change)
- Log retry attempts for debugging
- Keep backoff simple (1s, 2s, 4s) - no jitter needed for single-user app
- Temp file cleanup must happen even on retry

---

## Acceptance Criteria

- [ ] Retry logic implemented in scriptExecution.ts
- [ ] Retries use exponential backoff (1s, 2s, 4s)
- [ ] Maximum 3 retries
- [ ] Only retries on transient errors (app_unavailable)
- [ ] Does NOT retry permission errors
- [ ] Retry attempts logged to stderr
- [ ] Temp files cleaned up on retry
- [ ] Version bump in package.json

---

## Testing

Manual testing steps:
1. Start MCP server
2. Call a tool while OmniFocus is closed
3. Verify error returns immediately (no retry - app not running isn't transient)
4. Start OmniFocus, revoke automation permission
5. Call a tool
6. Verify error returns immediately (no retry - permission error)

---

## References

- PERFORMANCE_AND_PATTERNS.md: "JXA Bridge with Retry and Error Categorization" section
