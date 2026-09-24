import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { categorizeError, isStructuredError, type StructuredError } from '../../utils/errors.js';

export interface DiagnosticResult {
  success: boolean;
  checks: {
    omnifocusRunning: boolean;
    automationPermission: boolean;
    scriptExecution: boolean;
    omnifocusVersion: string | null;
    features: {
      customPerspectives: boolean;
      customPerspectiveCount: number;
    } | null;
    taskCount: number | null;
    projectCount: number | null;
    tagCount: number | null;
  };
  errors: string[];
  instructions: string[];
  summary: string;
}

/**
 * Diagnose OmniFocus connection and permissions
 * This tool helps identify common setup issues
 */
export async function diagnoseConnection(): Promise<DiagnosticResult> {
  const checks = {
    omnifocusRunning: false,
    automationPermission: false,
    scriptExecution: false,
    omnifocusVersion: null as string | null,
    features: null as { customPerspectives: boolean; customPerspectiveCount: number } | null,
    taskCount: null as number | null,
    projectCount: null as number | null,
    tagCount: null as number | null
  };

  const errors: string[] = [];
  const instructions: string[] = [];

  /**
   * Record one classified failure, whichever way it arrived.
   *
   * A failure reaches this tool by two different routes, and only one of them
   * used to be classified. The JXA wrapper in scriptExecution.ts catches every
   * Apple-event exception and returns {error: message} on stdout, so osascript
   * exits 0: an automation denial or a stopped OmniFocus parses as JSON, throws
   * nothing, and lands in the payload branch below. That branch reported
   * "Script error: ..." with no instructions at all -- so the tool written to
   * say "open System Settings > Privacy & Security > Automation" answered a
   * denial with an empty list, which is worse than the generic advice issue #152
   * complained about. Both routes now classify the same way, and every branch
   * here ends with at least one instruction.
   */
  const recordFailure = (structured: StructuredError): void => {
    const { type, message, instructions: advice } = structured.error;

    if (type === 'timeout') {
      errors.push('Script execution timed out');
      instructions.push(
        'OmniFocus may be unresponsive or busy syncing.',
        'Try restarting OmniFocus and run this diagnostic again.'
      );
    } else if (type === 'permission_denied') {
      checks.omnifocusRunning = true; // It got far enough to be refused, so OF is probably running
      errors.push('Automation permission denied');
      instructions.push(
        '1. Open System Settings > Privacy & Security > Automation',
        '2. Find your terminal app (Terminal, iTerm, VS Code, Cursor, etc.)',
        '3. Enable the checkbox for OmniFocus',
        '4. Restart the MCP server'
      );
    } else if (type === 'app_unavailable') {
      errors.push('OmniFocus is not running');
      instructions.push('Start OmniFocus and try again');
    } else {
      // Unclassified: show what was actually said, since no specific advice fits.
      errors.push(`Unknown error: ${message}`);
      // A structured error carries its own advice; prefer it to the generic list.
      instructions.push(
        ...(advice?.length ? advice : [
          'Check that OmniFocus is installed and running.',
          'Ensure automation permissions are granted.',
          'Try restarting OmniFocus and the MCP server.'
        ])
      );
    }
  };

  try {
    // This will fail if OmniFocus not running or no permission
    const result = await executeOmniFocusScript('@diagnoseConnection.js');

    // Parse result if it's a string
    let parsed;
    if (typeof result === 'string') {
      parsed = JSON.parse(result);
    } else {
      parsed = result;
    }

    if (parsed.success) {
      checks.omnifocusRunning = true;
      checks.automationPermission = true;
      checks.scriptExecution = true;
      checks.omnifocusVersion = parsed.version;
      checks.features = parsed.features;
      checks.taskCount = parsed.taskCount;
      checks.projectCount = parsed.projectCount;
      checks.tagCount = parsed.tagCount;
    } else {
      // Not an exception: the wrapper turned one into stdout. Classify the text
      // the same way categorizeError would have, so this branch gives the same
      // specific advice instead of none.
      const reported = typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error
        : 'OmniFocus reported a failure with no message';
      recordFailure(categorizeError(new Error(reported)));
    }

  } catch (error) {
    // Match on the structured type where we have one. Since #152 every failure
    // from executeOmniFocusScript is an OmniFocusError, so this is the normal
    // path; categorizeError covers anything else, including the message-text
    // matching this branch used to do inline.
    recordFailure(isStructuredError(error) ? error : categorizeError(error));
  }

  // Build summary
  let summary: string;
  if (errors.length === 0) {
    const featureInfo = checks.features?.customPerspectives
      ? `Custom perspectives: ${checks.features.customPerspectiveCount}`
      : 'Custom perspectives: Not available';
    summary = `Connected to OmniFocus ${checks.omnifocusVersion}. ${featureInfo}. ` +
              `Database: ${checks.taskCount} tasks, ${checks.projectCount} projects, ${checks.tagCount} tags.`;
  } else {
    summary = `Connection failed: ${errors.join(', ')}`;
  }

  return {
    success: errors.length === 0,
    checks,
    errors,
    instructions,
    summary
  };
}
