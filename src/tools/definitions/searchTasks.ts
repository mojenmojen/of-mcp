import { z } from 'zod';
import { searchTasks } from '../primitives/searchTasks.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('searchTasks:handler');

export const schema = z.object({
  query: z.string().min(1)
    .describe("Search query - matches task names and notes"),
  matchMode: z.enum(["contains", "anyWord", "allWords", "exact"]).optional().default("contains")
    .describe("How to match: 'contains' (default), 'anyWord', 'allWords', or 'exact'"),
  searchIn: z.enum(["all", "name", "note"]).optional().default("all")
    .describe("Where to search: 'all' (default), 'name' only, or 'note' only"),
  includeCompleted: z.boolean().optional().default(false)
    .describe("Include completed tasks in results"),
  projectName: z.string().optional()
    .describe("Limit search to this project"),
  projectId: z.string().optional()
    .describe("Limit search to project with this ID"),
  limit: z.number().optional().default(50)
    .describe("Maximum results to return")
});

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    const result = await searchTasks(args);

    // Check if this is a large database rejection (returned as formatted error text)
    if (result.includes('Database contains') && result.includes('Please specify a projectName')) {
      log.warn('Large database search rejected', {
        query: args.query,
        matchMode: args.matchMode,
        hasProjectFilter: !!(args.projectName || args.projectId)
      });
    }

    return {
      content: [{
        type: "text" as const,
        text: result
      }]
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    log.error('Search failed', {
      error: errorMessage,
      query: args.query,
      projectName: args.projectName,
      projectId: args.projectId,
      matchMode: args.matchMode
    });
    return {
      content: [{
        type: "text" as const,
        text: `Error searching tasks: ${errorMessage}`
      }],
      isError: true
    };
  }
}
