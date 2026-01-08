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
export function categorizeError(error: any): StructuredError {
  const message = error.message?.toLowerCase() || '';
  const stderr = error.stderr?.toLowerCase() || '';
  const combined = message + ' ' + stderr;

  // Timeout errors (from our EXEC_OPTIONS timeout)
  if (error.killed && error.signal === 'SIGTERM') {
    return createTimeoutError(error.message);
  }

  // Permission errors
  if (combined.includes('not authorized') ||
      combined.includes('-1743') ||
      combined.includes('permission')) {
    return createPermissionError(error.message);
  }

  // App not running
  if (combined.includes('not running') ||
      combined.includes('-600') ||
      combined.includes("application isn't running")) {
    return createAppUnavailableError(error.message);
  }

  // Script syntax errors
  if (combined.includes('syntax error')) {
    return {
      success: false,
      error: {
        code: ErrorCodes.SCRIPT_SYNTAX_ERROR,
        type: 'script_error',
        message: 'Script syntax error',
        details: error.message,
        retryable: false
      }
    };
  }

  // Unknown errors
  return {
    success: false,
    error: {
      code: ErrorCodes.UNKNOWN_ERROR,
      type: 'unknown',
      message: error.message || 'Unknown error occurred',
      details: error.stack,
      retryable: false
    }
  };
}

/**
 * Check if an error is a StructuredError
 */
export function isStructuredError(error: any): error is StructuredError {
  return error &&
         typeof error === 'object' &&
         error.success === false &&
         error.error &&
         typeof error.error.code === 'string' &&
         typeof error.error.type === 'string';
}
