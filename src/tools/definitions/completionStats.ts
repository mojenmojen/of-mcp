import { z } from 'zod';
import { getCompletionStats } from '../primitives/completionStats.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  completedAfter: z.string().optional().describe("Start of period (ISO format: YYYY-MM-DD). Tasks completed on or after this date."),
  completedBefore: z.string().optional().describe("End of period (ISO format: YYYY-MM-DD). Tasks completed before this date."),
  groupBy: z.enum(["project", "tag", "folder"]).optional().describe("How to group the completion counts. Default: project"),
  minCount: z.number().optional().describe("Only include groups with at least this many completions. Default: 0")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await getCompletionStats(args);

    return {
      content: [{
        type: "text" as const,
        text: result
      }]
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      content: [{
        type: "text" as const,
        text: `Error getting completion stats: ${errorMessage}`
      }],
      isError: true
    };
  }
}
