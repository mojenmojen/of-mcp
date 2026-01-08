import { z } from 'zod';
import { batchMarkReviewed, BatchMarkReviewedParams } from '../primitives/batchMarkReviewed.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  projectIds: z.array(z.string()).optional().describe("Array of project IDs to mark as reviewed"),
  projectNames: z.array(z.string()).optional().describe("Array of project names to mark as reviewed (alternative to projectIds)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate at least one identifier array is provided
    const hasIds = args.projectIds && args.projectIds.length > 0;
    const hasNames = args.projectNames && args.projectNames.length > 0;

    if (!hasIds && !hasNames) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Must provide either projectIds or projectNames."
        }],
        isError: true
      };
    }

    // Call the batchMarkReviewed function
    const result = await batchMarkReviewed({
      projectIds: args.projectIds,
      projectNames: args.projectNames
    });

    if (result.success) {
      // All projects marked successfully
      let infoText = `✅ **Batch Mark Reviewed Complete**\n`;
      infoText += `• Total: ${result.totalCount}\n`;
      infoText += `• Successful: ${result.successCount}\n`;

      if (result.results && result.results.length > 0) {
        infoText += `\n**Details:**\n`;
        for (const r of result.results) {
          if (r.success) {
            infoText += `  ✓ ${r.name || r.id}`;
            if (r.nextReviewDate) {
              infoText += ` → Next: ${r.nextReviewDate}`;
            }
            infoText += '\n';
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: infoText.trim()
        }]
      };
    } else if (result.successCount && result.successCount > 0) {
      // Partial success
      let infoText = `⚠️ **Batch Mark Reviewed Partially Complete**\n`;
      infoText += `• Total: ${result.totalCount}\n`;
      infoText += `• Successful: ${result.successCount}\n`;
      infoText += `• Failed: ${result.failCount}\n`;

      if (result.results && result.results.length > 0) {
        infoText += `\n**Details:**\n`;
        for (const r of result.results) {
          if (r.success) {
            infoText += `  ✓ ${r.name || r.id}\n`;
          } else {
            infoText += `  ✗ ${r.name || r.id}: ${r.error}\n`;
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: infoText.trim()
        }],
        isError: true
      };
    } else {
      // Complete failure
      return {
        content: [{
          type: "text" as const,
          text: `Failed to mark projects as reviewed: ${result.error}`
        }],
        isError: true
      };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Tool execution error: ${errorMessage}`);
    return {
      content: [{
        type: "text" as const,
        text: `Error marking projects as reviewed: ${errorMessage}`
      }],
      isError: true
    };
  }
}
