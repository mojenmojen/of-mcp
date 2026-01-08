import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

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
      errors.push(`Script error: ${parsed.error}`);
    }

  } catch (error: any) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('timed out')) {
      errors.push('Script execution timed out');
      instructions.push(
        'OmniFocus may be unresponsive or busy syncing.',
        'Try restarting OmniFocus and run this diagnostic again.'
      );
    } else if (message.includes('not authorized') || message.includes('-1743') || message.includes('permission')) {
      checks.omnifocusRunning = true; // It tried to connect, so OF is probably running
      errors.push('Automation permission denied');
      instructions.push(
        '1. Open System Settings > Privacy & Security > Automation',
        '2. Find your terminal app (Terminal, iTerm, VS Code, Cursor, etc.)',
        '3. Enable the checkbox for OmniFocus',
        '4. Restart the MCP server'
      );
    } else if (message.includes('not running') || message.includes('-600') || message.includes("application isn't running")) {
      errors.push('OmniFocus is not running');
      instructions.push('Start OmniFocus and try again');
    } else {
      errors.push(`Unknown error: ${error.message}`);
      instructions.push(
        'Check that OmniFocus is installed and running.',
        'Ensure automation permissions are granted.',
        'Try restarting OmniFocus and the MCP server.'
      );
    }
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
