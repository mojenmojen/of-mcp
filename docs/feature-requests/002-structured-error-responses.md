# 002: Structured Error Responses

## Priority: High
## Effort: Medium (2-4 hours)
## Category: Infrastructure Improvement

---

## Problem Statement

Current error handling in of-mcp has several issues:

1. **Inconsistent error formats** - Some tools return `{ error: "message" }`, others throw, others return `{ success: false }`
2. **No error codes** - Errors are only identified by message text, making programmatic handling difficult
3. **No actionable instructions** - Users see "Failed to execute script" without guidance on how to fix it
4. **No error categorization** - Permission errors, app errors, and script errors all look the same

---

## Proposed Solution

Create a standardized error response system with:
1. Consistent error structure across all tools
2. Error codes for programmatic handling
3. Error types for categorization
4. Actionable instructions for common errors

---

## Files to Create

### `src/utils/errors.ts`
```typescript
export type ErrorType =
  | 'permission_denied'
  | 'app_unavailable'
  | 'script_error'
  | 'validation_error'
  | 'not_found'
  | 'unknown';

export interface StructuredError {
  success: false;
  error: {
    code: string;
    type: ErrorType;
    message: string;
    details?: string;
    instructions?: string[];
  };
}

export interface StructuredSuccess<T> {
  success: true;
  data: T;
}

export type StructuredResponse<T> = StructuredSuccess<T> | StructuredError;

// Error code constants
export const ErrorCodes = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  APP_NOT_RUNNING: 'APP_NOT_RUNNING',
  SCRIPT_SYNTAX_ERROR: 'SCRIPT_SYNTAX_ERROR',
  SCRIPT_EXECUTION_ERROR: 'SCRIPT_EXECUTION_ERROR',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// Error factory functions
export function createPermissionError(details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.PERMISSION_DENIED,
      type: 'permission_denied',
      message: 'OmniFocus automation permission required',
      details,
      instructions: [
        '1. Open System Settings > Privacy & Security > Automation',
        '2. Find your terminal app (Terminal, iTerm, VS Code, etc.)',
        '3. Enable the checkbox for OmniFocus',
        '4. Restart the MCP server'
      ]
    }
  };
}

export function createAppUnavailableError(details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.APP_NOT_RUNNING,
      type: 'app_unavailable',
      message: 'OmniFocus is not running',
      details,
      instructions: [
        'Start OmniFocus and try again'
      ]
    }
  };
}

export function createScriptError(message: string, details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.SCRIPT_EXECUTION_ERROR,
      type: 'script_error',
      message,
      details
    }
  };
}

export function createNotFoundError(itemType: string, identifier: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.ITEM_NOT_FOUND,
      type: 'not_found',
      message: `${itemType} not found: ${identifier}`,
      instructions: [
        `Verify the ${itemType.toLowerCase()} exists in OmniFocus`,
        'Check for typos in the name or ID',
        'Use list_projects or filter_tasks to find available items'
      ]
    }
  };
}

export function createValidationError(message: string, details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.VALIDATION_ERROR,
      type: 'validation_error',
      message,
      details
    }
  };
}

// Categorize raw errors from script execution
export function categorizeError(error: any): StructuredError {
  const message = error.message?.toLowerCase() || '';
  const stderr = error.stderr?.toLowerCase() || '';
  const combined = message + ' ' + stderr;

  if (combined.includes('not authorized') ||
      combined.includes('-1743') ||
      combined.includes('permission')) {
    return createPermissionError(error.message);
  }

  if (combined.includes('not running') ||
      combined.includes('-600') ||
      combined.includes('application isn\'t running')) {
    return createAppUnavailableError(error.message);
  }

  if (combined.includes('syntax error')) {
    return {
      success: false,
      error: {
        code: ErrorCodes.SCRIPT_SYNTAX_ERROR,
        type: 'script_error',
        message: 'Script syntax error',
        details: error.message
      }
    };
  }

  return {
    success: false,
    error: {
      code: ErrorCodes.UNKNOWN_ERROR,
      type: 'unknown',
      message: error.message || 'Unknown error occurred',
      details: error.stack
    }
  };
}
```

---

## Files to Modify

### `src/utils/scriptExecution.ts`
Update error handling to use structured errors:
```typescript
import { categorizeError, StructuredError } from './errors.js';

export async function executeOmniFocusScript(scriptPath: string, args?: any): Promise<any> {
  try {
    // ... existing implementation ...
  } catch (error) {
    const structuredError = categorizeError(error);
    // Log for debugging
    console.error(`[ERROR] ${structuredError.error.code}: ${structuredError.error.message}`);
    throw structuredError;
  }
}
```

### Tool primitives (gradual migration)
Update each primitive to use structured responses:
```typescript
// Before
return { error: "Item not found" };

// After
import { createNotFoundError } from '../../utils/errors.js';
return createNotFoundError('Task', taskId);
```

---

## Implementation Notes

- This is foundational infrastructure that other features depend on
- Migrate tools incrementally - don't try to update all at once
- Maintain backward compatibility during migration (both old and new format work)
- Error instructions should be specific and actionable

---

## Acceptance Criteria

- [ ] `src/utils/errors.ts` created with all error types and factories
- [ ] `scriptExecution.ts` updated to categorize errors
- [ ] At least 3 tool primitives migrated to use structured errors
- [ ] Error responses include actionable instructions where applicable
- [ ] Tests pass (if any exist)
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Structured Error Responses" section
- PERFORMANCE_AND_PATTERNS.md: "Permission Handling and Error Recovery" section
