import { z } from 'zod';
import { addProject, AddProjectParams } from '../primitives/addProject.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  name: z.string().describe("The name of the project"),
  note: z.string().optional().describe("Additional notes for the project"),
  dueDate: z.string().optional().describe("The due date of the project in ISO format (YYYY-MM-DD or full ISO date)"),
  deferDate: z.string().optional().describe("The defer date of the project in ISO format (YYYY-MM-DD or full ISO date)"),
  flagged: z.boolean().optional().describe("Whether the project is flagged or not"),
  estimatedMinutes: z.number().optional().describe("Estimated time to complete the project, in minutes"),
  tags: z.array(z.string()).optional().describe("Tags to assign to the project"),
  folderName: z.string().optional().describe("The name of the folder to add the project to (will add to root if not specified)"),
  folderId: z.string().optional().describe("The ID of the folder to add the project to (alternative to folderName)"),
  sequential: z.boolean().optional().describe("Whether tasks in the project should be sequential (default: false)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Call the addProject function 
    const result = await addProject(args as AddProjectParams);
    
    if (result.success) {
      // Project was added successfully
      let locationText = args.folderName 
        ? `in folder "${args.folderName}"` 
        : "at the root level";
        
      let tagText = args.tags && args.tags.length > 0
        ? ` with tags: ${args.tags.join(', ')}`
        : "";
        
      let dueDateText = args.dueDate
        ? ` due on ${new Date(args.dueDate).toLocaleDateString()}`
        : "";
        
      let sequentialText = args.sequential
        ? " (sequential)"
        : " (parallel)";
        
      // Include the project ID so callers can reference it
      const idText = result.projectId ? ` (id: ${result.projectId})` : '';

      return {
        content: [{
          type: "text" as const,
          text: `✅ Project "${args.name}"${idText} created successfully ${locationText}${dueDateText}${tagText}${sequentialText}.`
        }]
      };
    } else {
      // Project creation failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to create project: ${result.error}`
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
        text: `Error creating project: ${errorMessage}`
      }],
      isError: true
    };
  }
} 