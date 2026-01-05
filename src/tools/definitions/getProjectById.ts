import { z } from 'zod';
import { getProjectById, GetProjectByIdParams } from '../primitives/getProjectById.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  projectId: z.string().optional().describe("The ID of the project to retrieve"),
  projectName: z.string().optional().describe("The name of the project to retrieve (alternative to projectId)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that either projectId or projectName is provided
    if (!args.projectId && !args.projectName) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Either projectId or projectName must be provided."
        }],
        isError: true
      };
    }

    // Call the getProjectById function
    const result = await getProjectById(args as GetProjectByIdParams);

    if (result.success && result.project) {
      const project = result.project;

      // Format project information for display
      let infoText = `📁 **Project Information**\n`;
      infoText += `• **Name**: ${project.name}\n`;
      infoText += `• **ID**: ${project.id}\n`;
      infoText += `• **Status**: ${project.status}\n`;

      if (project.folderName) {
        infoText += `• **Folder**: ${project.folderName}\n`;
      }

      infoText += `• **Tasks**: ${project.remainingTaskCount} remaining (${project.taskCount} total)\n`;
      infoText += `• **Sequential**: ${project.sequential ? 'Yes' : 'No'}\n`;
      infoText += `• **Flagged**: ${project.flagged ? 'Yes' : 'No'}\n`;

      if (project.dueDate) {
        infoText += `• **Due Date**: ${project.dueDate}\n`;
      }

      if (project.deferDate) {
        infoText += `• **Defer Date**: ${project.deferDate}\n`;
      }

      if (project.estimatedMinutes) {
        infoText += `• **Estimated**: ${project.estimatedMinutes} minutes\n`;
      }

      if (project.note) {
        infoText += `• **Note**: ${project.note.substring(0, 200)}${project.note.length > 200 ? '...' : ''}\n`;
      }

      // Review information
      if (project.reviewInterval || project.nextReviewDate || project.lastReviewDate) {
        infoText += `\n📋 **Review Information**\n`;
        if (project.reviewInterval) {
          const days = Math.round(project.reviewInterval / 86400); // 86400 = seconds in a day
          infoText += `• **Review Interval**: ${days} day${days !== 1 ? 's' : ''}\n`;
        }
        if (project.nextReviewDate) {
          infoText += `• **Next Review**: ${project.nextReviewDate}\n`;
        }
        if (project.lastReviewDate) {
          infoText += `• **Last Reviewed**: ${project.lastReviewDate}\n`;
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: infoText
        }]
      };
    } else {
      // Project retrieval failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to retrieve project: ${result.error}`
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
        text: `Error retrieving project: ${error.message}`
      }],
      isError: true
    };
  }
}
