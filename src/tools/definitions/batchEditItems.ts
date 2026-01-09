import { z } from 'zod';
import { batchEditItems, BatchEditItemParams } from '../primitives/batchEditItems.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { repetitionRuleSchema } from '../../schemas/repetitionRule.js';

// Schema for a single edit operation
const editItemSchema = z.object({
  id: z.string().optional().describe("The ID of the task or project to edit"),
  name: z.string().optional().describe("The name of the task or project to edit (as fallback if ID not provided)"),
  itemType: z.enum(['task', 'project']).describe("Type of item to edit ('task' or 'project')"),

  // Common editable fields
  newName: z.string().optional().describe("New name for the item"),
  newNote: z.string().optional().describe("New note for the item"),
  newDueDate: z.string().optional().describe("New due date in ISO format (YYYY-MM-DD); set to empty string to clear"),
  newDeferDate: z.string().optional().describe("New defer date in ISO format (YYYY-MM-DD); set to empty string to clear"),
  newPlannedDate: z.string().optional().describe("New planned date in ISO format; set to empty string to clear"),
  newFlagged: z.boolean().optional().describe("Set flagged status"),
  newEstimatedMinutes: z.number().optional().describe("New estimated minutes"),

  // Tag operations (work on both tasks and projects)
  addTags: z.array(z.string()).optional().describe("Tags to add (works on both tasks and projects)"),
  removeTags: z.array(z.string()).optional().describe("Tags to remove (works on both tasks and projects)"),
  replaceTags: z.array(z.string()).optional().describe("Replace all existing tags (works on both tasks and projects)"),

  // Task-specific fields
  newStatus: z.enum(['incomplete', 'completed', 'dropped']).optional().describe("New status for tasks"),
  dropCompletely: z.boolean().optional().describe("When dropping a repeating task, set to true to drop completely"),
  newRepetitionRule: repetitionRuleSchema.nullable().optional().describe("New repetition rule (null to remove)"),

  // Task movement fields
  newProjectName: z.string().optional().describe("Move task to a different project"),
  newParentTaskId: z.string().optional().describe("Move task to be a subtask of another task (by ID)"),
  newParentTaskName: z.string().optional().describe("Move task to be a subtask of another task (by name)"),
  moveToInbox: z.boolean().optional().describe("Set to true to move task to inbox"),

  // Project-specific fields
  newSequential: z.boolean().optional().describe("Whether the project should be sequential"),
  newFolderName: z.string().optional().describe("New folder to move the project to"),
  newProjectStatus: z.enum(['active', 'completed', 'dropped', 'onHold']).optional().describe("New status for projects"),

  // Project review fields
  markReviewed: z.boolean().optional().describe("Mark project as reviewed")
});

export const schema = z.object({
  edits: z.array(editItemSchema).describe("Array of edit operations to perform")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    if (!args.edits || args.edits.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No edits provided."
        }],
        isError: true
      };
    }

    // Call the batchEditItems function
    const result = await batchEditItems(args.edits as BatchEditItemParams[]);

    if (result.success) {
      let message = `✅ Batch edit complete: ${result.successCount} succeeded`;
      if (result.failureCount > 0) {
        message += `, ${result.failureCount} failed`;
      }

      // Include details about each edit
      const details = result.results.map((item, index) => {
        const edit = args.edits[index];
        const identifier = edit.id || edit.name || `item ${index + 1}`;
        if (item.success) {
          const changes = item.changedProperties || 'no changes';
          return `- ✅ ${edit.itemType} "${identifier}": ${changes}`;
        } else {
          return `- ❌ ${edit.itemType} "${identifier}": ${item.error}`;
        }
      }).join('\n');

      return {
        content: [{
          type: "text" as const,
          text: `${message}\n\n${details}`
        }]
      };
    } else {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to process batch edit: ${result.error}`
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
        text: `Error processing batch edit: ${errorMessage}`
      }],
      isError: true
    };
  }
}
