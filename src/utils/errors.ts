/**
 * Structured error handling for OmniFocus MCP server
 * Provides consistent error formats with actionable instructions
 */

export type ErrorType =
  | 'permission_denied'
  | 'app_unavailable'
  | 'timeout'
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
    retryable: boolean;
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
  TIMEOUT: 'TIMEOUT',
  TIMEOUT_WRITE_UNVERIFIED: 'TIMEOUT_WRITE_UNVERIFIED',
  SCRIPT_SYNTAX_ERROR: 'SCRIPT_SYNTAX_ERROR',
  SCRIPT_EXECUTION_ERROR: 'SCRIPT_EXECUTION_ERROR',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

/**
 * A StructuredError that is also a real Error (issue #152).
 *
 * Tool handlers unwrap a caught value with
 * `error instanceof Error ? error.message : String(error)`, so throwing a plain
 * object gave the user "[object Object]" and lost the message entirely. Throwing
 * this instead fixes every handler without touching any of them: `message` is the
 * real text, while `success` and `error` stay own enumerable properties so
 * isStructuredError still recognises it and JSON.stringify still works.
 */
export class OmniFocusError extends Error implements StructuredError {
  readonly success = false as const;
  readonly error: StructuredError['error'];

  constructor(structured: StructuredError) {
    super(structured.error.message);
    this.name = 'OmniFocusError';
    this.error = structured.error;
  }
}

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
        '2. Find your terminal app (Terminal, iTerm, VS Code, Cursor, etc.)',
        '3. Enable the checkbox for OmniFocus',
        '4. Restart the MCP server'
      ],
      retryable: false
    }
  };
}

export function createAppUnavailableError(details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.APP_NOT_RUNNING,
      type: 'app_unavailable',
      message: 'OmniFocus is not running or unavailable',
      details,
      instructions: [
        'Start OmniFocus and try again'
      ],
      retryable: true
    }
  };
}

export function createTimeoutError(details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.TIMEOUT,
      type: 'timeout',
      message: 'Script execution timed out after 30 seconds',
      details,
      instructions: [
        'OmniFocus may be unresponsive or busy syncing.',
        'Try restarting OmniFocus and run the command again.'
      ],
      retryable: true
    }
  };
}

/**
 * The timeout error for a script that may have written something (issue #154).
 *
 * Killing the osascript subprocess does not cancel the OmniJS script already
 * running inside OmniFocus, so a timed-out write may well have landed. Saying
 * "failed" invites the caller to run it again and create a duplicate, which is
 * how one add_folder call produced four folders.
 *
 * The type stays 'timeout' so that type-based matching, such as
 * diagnose_connection's, keeps working; only the code and the wording differ.
 */
export function createWriteTimeoutError(details?: string): StructuredError {
  return {
    success: false,
    error: {
      code: ErrorCodes.TIMEOUT_WRITE_UNVERIFIED,
      type: 'timeout',
      message: 'Script execution timed out after 30 seconds. The change may still have been applied.',
      details,
      instructions: [
        'OmniFocus may be unresponsive or busy syncing.',
        'This was NOT retried: a timeout does not mean the change failed.',
        'Check OmniFocus before running this again, because running it again may create a duplicate.'
      ],
      retryable: false
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
      details,
      retryable: false
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
      ],
      retryable: false
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
      details,
      retryable: false
    }
  };
}

/**
 * Categorize raw errors from script execution into structured errors
 * Used by scriptExecution.ts to provide consistent error handling
 */
export function categorizeError(error: unknown): StructuredError {
  // Safely extract message using type guards
  const errorMessage = error instanceof Error ? error.message : String(error);
  const message = errorMessage.toLowerCase();
  const stderr = (isExecException(error) ? error.stderr : '')?.toLowerCase() || '';
  const combined = message + ' ' + stderr;

  // Timeout errors (from our EXEC_OPTIONS timeout)
  if (isExecException(error) && error.killed && error.signal === 'SIGTERM') {
    return createTimeoutError(errorMessage);
  }

  // Permission errors
  if (combined.includes('not authorized') ||
      combined.includes('-1743') ||
      combined.includes('permission')) {
    return createPermissionError(errorMessage);
  }

  // App not running
  if (combined.includes('not running') ||
      combined.includes('-600') ||
      combined.includes("application isn't running")) {
    return createAppUnavailableError(errorMessage);
  }

  // Script syntax errors
  if (combined.includes('syntax error')) {
    return {
      success: false,
      error: {
        code: ErrorCodes.SCRIPT_SYNTAX_ERROR,
        type: 'script_error',
        message: 'Script syntax error',
        details: errorMessage,
        retryable: false
      }
    };
  }

  // Unknown errors
  const errorStack = error instanceof Error ? error.stack : undefined;
  return {
    success: false,
    error: {
      code: ErrorCodes.UNKNOWN_ERROR,
      type: 'unknown',
      message: errorMessage || 'Unknown error occurred',
      details: errorStack,
      retryable: false
    }
  };
}

/**
 * Type guard for Node.js ExecException with process termination properties.
 * Used to safely access error.killed, error.signal, and error.stderr.
 */
export function isExecException(error: unknown): error is NodeJS.ErrnoException & {
  killed?: boolean;
  signal?: NodeJS.Signals;
  stderr?: string;
} {
  return typeof error === 'object' && error !== null && 'killed' in error;
}

/**
 * Check if an error is a StructuredError
 */
export function isStructuredError(error: unknown): error is StructuredError {
  if (typeof error !== 'object' || error === null) return false;
  const obj = error as Record<string, unknown>;
  if (obj.success !== false) return false;
  if (typeof obj.error !== 'object' || obj.error === null) return false;
  const errObj = obj.error as Record<string, unknown>;
  return typeof errObj.code === 'string' && typeof errObj.type === 'string';
}
