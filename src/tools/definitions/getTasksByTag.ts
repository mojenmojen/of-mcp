import { z } from 'zod';
import { getTasksByTag } from '../primitives/getTasksByTag.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  tagName: z.union([z.string(), z.array(z.string())]).describe("Name of tag(s) to filter tasks by. Can be a single tag or array of tags (e.g., ['work', 'urgent'])"),
  tagMatchMode: z.enum(["any", "all"]).optional().describe("How to match multiple tags: 'any' returns tasks with at least one tag (default), 'all' returns tasks with every specified tag"),
  hideCompleted: z.boolean().optional().describe("Set to false to show completed tasks with this tag (default: true)"),
  exactMatch: z.boolean().optional().describe("Set to true for exact tag name match, false for partial (default: false)"),
  limit: z.number().optional().describe("Maximum number of tasks to return (default: 500). Use to prevent timeout with many tags")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await getTasksByTag({
      tagName: args.tagName,
      tagMatchMode: args.tagMatchMode || 'any',
      hideCompleted: args.hideCompleted !== false, // Default to true
      exactMatch: args.exactMatch || false,
      limit: args.limit
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
        text: `Error getting tasks by tag: ${errorMessage}`
      }],
      isError: true
    };
  }
}