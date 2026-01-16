import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('listCustomPerspectives');

export interface ListCustomPerspectivesOptions {
  format?: 'simple' | 'detailed';
}

export async function listCustomPerspectives(options: ListCustomPerspectivesOptions = {}): Promise<string> {
  const { format = 'simple' } = options;
  
  try {
    log.debug('Starting listCustomPerspectives script');

    // Execute the list custom perspectives script
    const result = await executeOmniFocusScript('@listCustomPerspectives.js', {});

    log.debug('Script execution complete', { resultType: typeof result });

    // Handle various return types
    let data: any;

    if (typeof result === 'string') {
      log.debug('Result is string, attempting JSON parse');
      try {
        data = JSON.parse(result);
        log.debug('JSON parse successful');
      } catch (parseError) {
        log.error('JSON parse failed', { error: (parseError as Error).message });
        throw new Error(`Failed to parse string result: ${result}`);
      }
    } else if (typeof result === 'object' && result !== null) {
      log.debug('Result is object, using directly');
      data = result;
    } else {
      log.error('Invalid result type', { type: typeof result, value: result });
      throw new Error(`Script returned invalid result type: ${typeof result}, value: ${result}`);
    }

    // Check for errors
    if (!data.success) {
      throw new Error(data.error || 'Unknown error occurred');
    }

    // Format output
    if (data.count === 0) {
      return "📋 **Custom Perspectives**\n\nNo custom perspectives found.";
    }

    if (format === 'simple') {
      // Simple format: show name list only
      const perspectiveNames = data.perspectives.map((p: any) => p.name);
      return `📋 **Custom Perspectives** (${data.count})\n\n${perspectiveNames.map((name: string, index: number) => `${index + 1}. ${name}`).join('\n')}`;
    } else {
      // Detailed format: show name and identifier
      const perspectiveDetails = data.perspectives.map((p: any, index: number) =>
        `${index + 1}. **${p.name}**\n   🆔 ${p.identifier}`
      );
      return `📋 **Custom Perspectives** (${data.count})\n\n${perspectiveDetails.join('\n\n')}`;
    }

  } catch (error) {
    log.error('Error in listCustomPerspectives', { error: error instanceof Error ? error.message : String(error) });
    return `❌ **Error**: ${error instanceof Error ? error.message : String(error)}`;
  }
}