import { z } from 'zod';
import { editItem, EditItemParams } from '../primitives/editItem.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Schema for repetition rule (matches addOmniFocusTask)
const repetitionRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe("How often the task repeats"),
  interval: z.number().min(1).optional().describe("Repeat every N periods (default: 1)"),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().describe("Days of week to repeat on (0=Sunday, 6=Saturday). Only for weekly frequency."),
  dayOfMonth: z.number().min(1).max(31).optional().describe("Day of month to repeat on. Only for monthly frequency. Mutually exclusive with weekdayOfMonth."),
  weekdayOfMonth: z.object({
    week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(-1)]).describe("Week of month: 1=first, 2=second, 3=third, 4=fourth, 5=fifth, -1=last. Note: week 5 may not exist in all months (e.g., 5th Monday) - OmniFocus skips months without that occurrence."),
    day: z.number().min(0).max(6).describe("Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday")
  }).optional().describe("Weekday-of-month pattern (e.g., first Monday, last Friday). Only for monthly frequency. Mutually exclusive with dayOfMonth."),
  month: z.number().min(1).max(12).optional().describe("Month to repeat in. Only for yearly frequency."),
  repeatFrom: z.enum(['due', 'completion']).optional().describe("Repeat from due date or completion date (default: due)")
}).refine(
  data => !(data.dayOfMonth && data.weekdayOfMonth),
  { message: "Cannot specify both dayOfMonth and weekdayOfMonth" }
).refine(
  data => !data.weekdayOfMonth || data.frequency === 'monthly',
  { message: "weekdayOfMonth can only be used with monthly frequency" }
).refine(
  data => !data.dayOfMonth || data.frequency === 'monthly',
  { message: "dayOfMonth can only be used with monthly frequency" }
).refine(
  data => !data.daysOfWeek || data.daysOfWeek.length === 0 || data.frequency === 'weekly',
  { message: "daysOfWeek can only be used with weekly frequency" }
);

export const schema = z.object({
  id: z.string().optional().describe("The ID of the task or project to edit"),
  name: z.string().optional().describe("The name of the task or project to edit (as fallback if ID not provided)"),
  itemType: z.enum(['task', 'project']).describe("Type of item to edit ('task' or 'project')"),
  
  // Common editable fields
  newName: z.string().optional().describe("New name for the item"),
  newNote: z.string().optional().describe("New note for the item"),
  newDueDate: z.string().optional().describe("New due date in ISO format (YYYY-MM-DD or full ISO date); set to empty string to clear"),
  newDeferDate: z.string().optional().describe("New defer date in ISO format (YYYY-MM-DD or full ISO date); set to empty string to clear"),
  newPlannedDate: z.string().optional().describe("New planned date (when you intend to work on this) in ISO format; set to empty string to clear"),
  newFlagged: z.boolean().optional().describe("Set flagged status (set to false for no flag, true for flag)"),
  newEstimatedMinutes: z.number().optional().describe("New estimated minutes"),
  
  // Task-specific fields
  newStatus: z.enum(['incomplete', 'completed', 'dropped']).optional().describe("New status for tasks (incomplete, completed, dropped)"),
  dropCompletely: z.boolean().optional().describe("When dropping a repeating task, set to true to drop completely (stop all future occurrences). Default false drops only the current occurrence."),
  addTags: z.array(z.string()).optional().describe("Tags to add to the task"),
  removeTags: z.array(z.string()).optional().describe("Tags to remove from the task"),
  replaceTags: z.array(z.string()).optional().describe("Tags to replace all existing tags with"),
  newRepetitionRule: repetitionRuleSchema.nullable().optional().describe("New repetition rule for the task. Set to null to remove repetition, or provide object to set. Examples: null (remove), {frequency: 'daily'}, {frequency: 'weekly', daysOfWeek: [1,3,5]}"),

  // Task movement fields
  newProjectName: z.string().optional().describe("Move task to a different project (by project name)"),
  newProjectId: z.string().optional().describe("Move task to a different project (by project ID)"),
  newParentTaskId: z.string().optional().describe("Move task to be a subtask of another task (by task ID)"),
  newParentTaskName: z.string().optional().describe("Move task to be a subtask of another task (by task name)"),
  moveToInbox: z.boolean().optional().describe("Set to true to move task to inbox"),

  // Project-specific fields
  newSequential: z.boolean().optional().describe("Whether the project should be sequential"),
  newFolderName: z.string().optional().describe("New folder to move the project to (by folder name)"),
  newFolderId: z.string().optional().describe("New folder to move the project to (by folder ID)"),
  newProjectStatus: z.enum(['active', 'completed', 'dropped', 'onHold']).optional().describe("New status for projects"),

  // Project review fields
  markReviewed: z.boolean().optional().describe("Mark project as reviewed (advances next review date by interval). Only applies to projects."),
  newReviewInterval: z.number().optional().describe("Set new review interval in days. Only applies to projects."),
  newNextReviewDate: z.string().optional().describe("Set next review date directly (ISO format YYYY-MM-DD). Only applies to projects.")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that either id or name is provided
    if (!args.id && !args.name) {
      return {
        content: [{
          type: "text" as const,
          text: "Either id or name must be provided to edit an item."
        }],
        isError: true
      };
    }
    
    // Call the editItem function 
    const result = await editItem(args as EditItemParams);
    
    if (result.success) {
      // Item was edited successfully
      const itemTypeLabel = args.itemType === 'task' ? 'Task' : 'Project';
      let changedText = '';
      
      if (result.changedProperties) {
        changedText = ` (${result.changedProperties})`;
      }
      
      return {
        content: [{
          type: "text" as const,
          text: `✅ ${itemTypeLabel} "${result.name}" updated successfully${changedText}.`
        }]
      };
    } else {
      // Item editing failed
      let errorMsg = `Failed to update ${args.itemType}`;
      
      if (result.error) {
        if (result.error.includes("Item not found")) {
          errorMsg = `${args.itemType.charAt(0).toUpperCase() + args.itemType.slice(1)} not found`;
          if (args.id) errorMsg += ` with ID "${args.id}"`;
          if (args.name) errorMsg += `${args.id ? ' or' : ' with'} name "${args.name}"`;
          errorMsg += '.';
        } else {
          errorMsg += `: ${result.error}`;
        }
      }
      
      return {
        content: [{
          type: "text" as const,
          text: errorMsg
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
        text: `Error updating ${args.itemType}: ${errorMessage}`
      }],
      isError: true
    };
  }
} 