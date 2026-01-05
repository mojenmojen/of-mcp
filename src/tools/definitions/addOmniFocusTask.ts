import { z } from 'zod';
import { addOmniFocusTask, AddOmniFocusTaskParams } from '../primitives/addOmniFocusTask.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

// Schema for repetition rule
const repetitionRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).describe("How often the task repeats"),
  interval: z.number().min(1).optional().describe("Repeat every N periods (default: 1)"),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional().describe("Days of week to repeat on (0=Sunday, 6=Saturday). Only for weekly frequency."),
  dayOfMonth: z.number().min(1).max(31).optional().describe("Day of month to repeat on. Only for monthly frequency."),
  month: z.number().min(1).max(12).optional().describe("Month to repeat in. Only for yearly frequency."),
  repeatFrom: z.enum(['due', 'completion']).optional().describe("Repeat from due date or completion date (default: due)")
}).describe("Repetition rule for recurring tasks");

export const schema = z.object({
  name: z.string().describe("The name of the task"),
  note: z.string().optional().describe("Additional notes for the task"),
  dueDate: z.string().optional().describe("The due date of the task in ISO format (YYYY-MM-DD or full ISO date)"),
  deferDate: z.string().optional().describe("The defer date of the task in ISO format (YYYY-MM-DD or full ISO date)"),
  plannedDate: z.string().optional().describe("The planned date (when you intend to work on this) in ISO format (YYYY-MM-DD or full ISO date)"),
  flagged: z.boolean().optional().describe("Whether the task is flagged or not"),
  estimatedMinutes: z.number().optional().describe("Estimated time to complete the task, in minutes"),
  tags: z.array(z.string()).optional().describe("Tags to assign to the task"),
  projectName: z.string().optional().describe("The name of the project to add the task to (will add to inbox if not specified)"),
  parentTaskId: z.string().optional().describe("The ID of the parent task to create this task as a subtask"),
  parentTaskName: z.string().optional().describe("The name of the parent task to create this task as a subtask (alternative to parentTaskId)"),
  repetitionRule: repetitionRuleSchema.optional().describe("Repetition rule for recurring tasks. Examples: {frequency: 'daily'}, {frequency: 'weekly', daysOfWeek: [1,3,5]}, {frequency: 'monthly', dayOfMonth: 15}")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Call the addOmniFocusTask function 
    const result = await addOmniFocusTask(args as AddOmniFocusTaskParams);
    
    if (result.success) {
      // Task was added successfully
      let locationText;
      if (args.parentTaskId || args.parentTaskName) {
        const parentRef = args.parentTaskId || args.parentTaskName;
        locationText = `as a subtask of "${parentRef}"`;
      } else if (args.projectName) {
        locationText = `in project "${args.projectName}"`;
      } else {
        locationText = "in your inbox";
      }
        
      let tagText = args.tags && args.tags.length > 0
        ? ` with tags: ${args.tags.join(', ')}`
        : "";
        
      let dueDateText = args.dueDate
        ? ` due on ${new Date(args.dueDate).toLocaleDateString()}`
        : "";

      let plannedDateText = args.plannedDate
        ? ` planned for ${new Date(args.plannedDate).toLocaleDateString()}`
        : "";

      let repeatText = "";
      if (args.repetitionRule) {
        const freq = args.repetitionRule.frequency;
        const interval = args.repetitionRule.interval || 1;
        repeatText = interval > 1 ? ` repeating every ${interval} ${freq.replace('ly', '')}s` : ` repeating ${freq}`;
        if (args.repetitionRule.repeatFrom === 'completion') {
          repeatText += ' (from completion)';
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: `✅ Task "${args.name}" created successfully ${locationText}${dueDateText}${plannedDateText}${tagText}${repeatText}.`
        }]
      };
    } else {
      // Task creation failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to create task: ${result.error}`
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
        text: `Error creating task: ${error.message}`
      }],
      isError: true
    };
  }
} 