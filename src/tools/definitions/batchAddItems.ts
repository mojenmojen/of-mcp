import { z } from 'zod';
import { batchAddItems, BatchAddItemsParams } from '../primitives/batchAddItems.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  items: z.array(z.object({
    type: z.enum(['task', 'project']).describe("Type of item to add ('task' or 'project')"),
    name: z.string().describe("The name of the item"),
    note: z.string().optional().describe("Additional notes for the item"),
    dueDate: z.string().optional().describe("The due date in ISO format (YYYY-MM-DD or full ISO date)"),
    deferDate: z.string().optional().describe("The defer date in ISO format (YYYY-MM-DD or full ISO date)"),
    flagged: z.boolean().optional().describe("Whether the item is flagged or not"),
    estimatedMinutes: z.number().optional().describe("Estimated time to complete the item, in minutes"),
    tags: z.array(z.string()).optional().describe("Tags to assign to the item"),
    
    // Task-specific properties
    projectName: z.string().optional().describe("For tasks: The name of the project to add the task to"),
    projectId: z.string().optional().describe("For tasks: The ID of the project to add the task to (alternative to projectName)"),
    parentTaskId: z.string().optional().describe("For tasks: The ID of the parent task to create this task as a subtask"),
    parentTaskName: z.string().optional().describe("For tasks: The name of the parent task to create this task as a subtask"),

    // Project-specific properties
    folderName: z.string().optional().describe("For projects: The name of the folder to add the project to"),
    folderId: z.string().optional().describe("For projects: The ID of the folder to add the project to (alternative to folderName)"),
    sequential: z.boolean().optional().describe("For projects: Whether tasks in the project should be sequential")
  })).describe("Array of items (tasks or projects) to add")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Call the batchAddItems function (now uses true batching - single OmniJS script)
    const result = await batchAddItems(args.items as BatchAddItemsParams[]);

    if (result.success) {
      let message = `✅ Successfully added ${result.successCount} items.`;

      if (result.failureCount > 0) {
        message += ` ⚠️ Failed to add ${result.failureCount} items.`;
      }

      // Include details about added items
      const details = result.results.map((item, index) => {
        const inputItem = args.items[index];
        if (item.success) {
          return `- ✅ ${inputItem.type}: "${inputItem.name}"`;
        } else {
          return `- ❌ ${inputItem.type}: "${inputItem.name}" - Error: ${item.error}`;
        }
      }).join('\n');

      return {
        content: [{
          type: "text" as const,
          text: `${message}\n\n${details}`
        }]
      };
    } else {
      // Batch operation failed completely
      return {
        content: [{
          type: "text" as const,
          text: `Failed to process batch operation: ${result.error}`
        }],
        isError: true
      };
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{
        type: "text" as const,
        text: `Error processing batch operation: ${error.message}`
      }],
      isError: true
    };
  }
} 