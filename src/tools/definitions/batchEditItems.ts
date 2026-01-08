import { z } from 'zod';
import { batchEditItems, BatchEditItemParams } from '../primitives/batchEditItems.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Schema for repetition rule
const repetitionRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe("How often the task repeats"),
  interval: z.number().min(1).optional().describe("Repeat every N periods (default: 1)"),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().describe("Days of week to repeat on (0=Sunday, 6=Saturday). Only for weekly frequency."),
  dayOfMonth: z.number().min(1).max(31).optional().describe("Day of month to repeat on. Only for monthly frequency. Mutually exclusive with weekdayOfMonth."),
  weekdayOfMonth: z.object({
    week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(-1)]).describe("Week of month: 1=first, 2=second, 3=third, 4=fourth, 5=fifth, -1=last"),
    day: z.number().min(0).max(6).describe("Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday")
  }).optional().describe("Weekday-of-month pattern (e.g., first Monday, last Friday). Only for monthly frequency. Mutually exclusive with dayOfMonth."),
  month: z.number().min(1).max(12).optional().describe("Month to repeat in. Only for yearly frequency."),
  repeatFrom: z.enum(['due', 'completion']).optional().describe("Repeat from due date or completion date (default: due)")
}).refine(
  data => !(data.dayOfMonth && data.weekdayOfMonth),
  { message: "Cannot specify both dayOfMonth and weekdayOfMonth" }
);

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

  // Task-specific fields
  newStatus: z.enum(['incomplete', 'completed', 'dropped']).optional().describe("New status for tasks"),
  dropCompletely: z.boolean().optional().describe("When dropping a repeating task, set to true to drop completely"),
  addTags: z.array(z.string()).optional().describe("Tags to add to the task"),
  removeTags: z.array(z.string()).optional().describe("Tags to remove from the task"),
  replaceTags: z.array(z.string()).optional().describe("Tags to replace all existing tags with"),
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
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [{
        type: "text" as const,
        text: `Error processing batch edit: ${error.message}`
      }],
      isError: true
    };
  }
}
