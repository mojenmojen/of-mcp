import { z } from 'zod';
import { diagnoseConnection } from '../primitives/diagnoseConnection.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({});

export async function handler(_args: z.infer<typeof schema>, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await diagnoseConnection();

    // Format output for display
    let output = '';

    if (result.success) {
      output += `✅ **Connection Successful**\n\n`;
      output += `**OmniFocus Version**: ${result.checks.omnifocusVersion}\n`;
      if (result.checks.features?.customPerspectives) {
        output += `**Custom Perspectives**: Available (${result.checks.features.customPerspectiveCount} found)\n`;
      } else {
        output += `**Custom Perspectives**: Not available\n`;
      }
      output += `**Database Stats**:\n`;
      output += `  • Tasks: ${result.checks.taskCount}\n`;
      output += `  • Projects: ${result.checks.projectCount}\n`;
      output += `  • Tags: ${result.checks.tagCount}\n`;
    } else {
      output += `❌ **Connection Failed**\n\n`;
      output += `**Errors**:\n`;
      for (const error of result.errors) {
        output += `  • ${error}\n`;
      }

      if (result.instructions.length > 0) {
        output += `\n**To Fix**:\n`;
        for (const instruction of result.instructions) {
          output += `${instruction}\n`;
        }
      }

      output += `\n**Diagnostic Details**:\n`;
      output += `  • OmniFocus Running: ${result.checks.omnifocusRunning ? 'Yes' : 'Unknown'}\n`;
      output += `  • Automation Permission: ${result.checks.automationPermission ? 'Yes' : 'No'}\n`;
      output += `  • Script Execution: ${result.checks.scriptExecution ? 'Yes' : 'No'}\n`;
    }

    return {
      content: [{
        type: "text" as const,
        text: output
      }]
    };

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      content: [{
        type: "text" as const,
        text: `Error running diagnostics: ${errorMessage}`
      }],
      isError: true
    };
  }
}
