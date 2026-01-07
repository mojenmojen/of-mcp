import { z } from 'zod';
import { getFlaggedTasks } from '../primitives/getFlaggedTasks.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  hideCompleted: z.boolean().optional().describe("Set to false to show completed flagged tasks (default: true)"),
  projectFilter: z.string().optional().describe("Filter flagged tasks by project name (optional)"),
  projectId: z.string().optional().describe("Filter flagged tasks by project ID (alternative to projectFilter)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await getFlaggedTasks({
      hideCompleted: args.hideCompleted !== false, // Default to true
      projectFilter: args.projectFilter,
      projectId: args.projectId
    });
    
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
        text: `Error getting flagged tasks: ${errorMessage}`
      }],
      isError: true
    };
  }
}