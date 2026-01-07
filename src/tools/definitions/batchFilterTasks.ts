import { z } from 'zod';
import { batchFilterTasks } from '../primitives/batchFilterTasks.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Task status enum
const TaskStatusEnum = z.enum([
  "Available",
  "Next",
  "Blocked",
  "DueSoon",
  "Overdue",
  "Completed",
  "Dropped"
]);

export const schema = z.object({
  // Project filters - at least one required
  projectIds: z.array(z.string()).optional().describe("Array of project IDs to filter by"),
  projectNames: z.array(z.string()).optional().describe("Array of project names to filter by (partial match)"),

  // Task status filtering
  taskStatus: z.array(TaskStatusEnum).optional().describe("Filter by task status. Can specify multiple statuses"),

  // Due date filtering
  dueToday: z.boolean().optional().describe("Show tasks due today"),
  dueThisWeek: z.boolean().optional().describe("Show tasks due this week"),
  overdue: z.boolean().optional().describe("Show overdue tasks only"),

  // Other filters
  flagged: z.boolean().optional().describe("Filter by flagged status"),

  // Output control
  limit: z.number().max(500).optional().describe("Maximum tasks per project (default: 100)"),
  sortBy: z.enum(["name", "dueDate", "deferDate", "flagged"]).optional().describe("Sort results by field"),
  sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort order (default: asc)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that at least one project filter is provided
    if ((!args.projectIds || args.projectIds.length === 0) &&
        (!args.projectNames || args.projectNames.length === 0)) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Either projectIds or projectNames must be provided with at least one value"
        }],
        isError: true
      };
    }

    const result = await batchFilterTasks(args);

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
        text: `Error in batch filter: ${errorMessage}`
      }],
      isError: true
    };
  }
}
