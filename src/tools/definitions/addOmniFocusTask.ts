import { z } from 'zod';
import { addOmniFocusTask, AddOmniFocusTaskParams } from '../primitives/addOmniFocusTask.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { repetitionRuleSchema } from '../../schemas/repetitionRule.js';

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
  projectId: z.string().optional().describe("The ID of the project to add the task to (alternative to projectName)"),
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

      // Include the task ID so callers can reference it
      const idText = result.taskId ? ` (id: ${result.taskId})` : '';

      return {
        content: [{
          type: "text" as const,
          text: `✅ Task "${args.name}"${idText} created successfully ${locationText}${dueDateText}${plannedDateText}${tagText}${repeatText}.`
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Tool execution error: ${errorMessage}`);
    return {
      content: [{
        type: "text" as const,
        text: `Error creating task: ${errorMessage}`
      }],
      isError: true
    };
  }
} 