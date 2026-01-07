import { z } from 'zod';
import { getCustomPerspectiveTasks } from '../primitives/getCustomPerspectiveTasks.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  perspectiveName: z.string().optional().describe("Exact name of the OmniFocus custom perspective (e.g., 'Today', 'Daily Review', 'This Week'). This is NOT a tag name."),
  perspectiveId: z.string().optional().describe("ID of the custom perspective (alternative to perspectiveName). Get IDs from list_custom_perspectives."),
  hideCompleted: z.boolean().optional().describe("Whether to hide completed tasks. Set to false to show all tasks including completed ones (default: true)"),
  limit: z.number().optional().describe("Maximum number of tasks to return in flat view mode (default: 1000, ignored in hierarchy mode)"),
  showHierarchy: z.boolean().optional().describe("Display tasks in hierarchical tree structure showing parent-child relationships (default: false)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that at least one identifier is provided
    if (!args.perspectiveName && !args.perspectiveId) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Must provide either perspectiveName or perspectiveId"
        }],
        isError: true
      };
    }

    const result = await getCustomPerspectiveTasks({
      perspectiveName: args.perspectiveName,
      perspectiveId: args.perspectiveId,
      hideCompleted: args.hideCompleted !== false, // Default to true
      limit: args.limit || 1000,
      showHierarchy: args.showHierarchy || false // Default to false
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
        text: `Error getting custom perspective tasks: ${errorMessage}`
      }],
      isError: true
    };
  }
}