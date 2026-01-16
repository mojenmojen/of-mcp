import { z } from 'zod';
import { getTaskById, GetTaskByIdParams } from '../primitives/getTaskById.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { formatDateSafe } from '../../utils/dateUtils.js';

export const schema = z.object({
  taskId: z.string().optional().describe("The ID of the task to retrieve"),
  taskName: z.string().optional().describe("The name of the task to retrieve (alternative to taskId)")
});

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that either taskId or taskName is provided
    if (!args.taskId && !args.taskName) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Either taskId or taskName must be provided."
        }],
        isError: true
      };
    }

    // Call the getTaskById function 
    const result = await getTaskById(args as GetTaskByIdParams);
    
    if (result.success && result.task) {
      const task = result.task;
      
      // Format task information for display
      let infoText = `📋 **Task Information**\n`;
      infoText += `• **Name**: ${task.name}\n`;
      infoText += `• **ID**: ${task.id}\n`;
      
      if (task.note) {
        infoText += `• **Note**: ${task.note}\n`;
      }
      
      if (task.parentId && task.parentName) {
        infoText += `• **Parent Task**: ${task.parentName} (${task.parentId})\n`;
      }
      
      if (task.projectId && task.projectName) {
        infoText += `• **Project**: ${task.projectName} (${task.projectId})\n`;
      }

      const dueDate = formatDateSafe(task.dueDate);
      if (dueDate) {
        infoText += `• **Due Date**: ${dueDate}\n`;
      }

      const deferDate = formatDateSafe(task.deferDate);
      if (deferDate) {
        infoText += `• **Defer Date**: ${deferDate}\n`;
      }

      const plannedDate = formatDateSafe(task.plannedDate);
      if (plannedDate) {
        infoText += `• **Planned Date**: ${plannedDate}\n`;
      }

      const createdDate = formatDateSafe(task.createdDate);
      if (createdDate) {
        infoText += `• **Created**: ${createdDate}\n`;
      }

      infoText += `• **Has Children**: ${task.hasChildren ? `Yes (${task.childrenCount} subtasks)` : 'No'}\n`;

      if (task.isRepeating && task.repetitionRule) {
        infoText += `• **Repeats**: ${task.repetitionRule}\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: infoText
        }]
      };
    } else {
      // Task retrieval failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to retrieve task: ${result.error}`
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
        text: `Error retrieving task: ${errorMessage}`
      }],
      isError: true
    };
  }
}