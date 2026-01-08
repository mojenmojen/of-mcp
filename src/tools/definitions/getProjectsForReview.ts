import { z } from 'zod';
import { getProjectsForReview, GetProjectsForReviewParams } from '../primitives/getProjectsForReview.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  includeOnHold: z.boolean().optional().describe("Include on-hold projects in results (default: false)"),
  limit: z.number().optional().describe("Maximum number of projects to return (default: 50)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Call the getProjectsForReview function
    const result = await getProjectsForReview(args as GetProjectsForReviewParams);

    if (result.success && result.projects) {
      if (result.projects.length === 0) {
        return {
          content: [{
            type: "text" as const,
            text: "No projects need review at this time."
          }]
        };
      }

      // Format project list for display
      let infoText = `📋 **Projects Needing Review** (${result.returnedCount}${result.totalCount && result.totalCount > result.returnedCount! ? ` of ${result.totalCount}` : ''})\n\n`;

      for (const project of result.projects) {
        infoText += `**${project.name}** (ID: ${project.id})\n`;

        if (project.folderName) {
          infoText += `  • Folder: ${project.folderName}\n`;
        }

        infoText += `  • Status: ${project.status}\n`;
        infoText += `  • Remaining Tasks: ${project.remainingTaskCount}\n`;

        if (project.reviewInterval) {
          const days = Math.round(project.reviewInterval / 86400);
          infoText += `  • Review Interval: ${days} day${days !== 1 ? 's' : ''}\n`;
        }

        if (project.nextReviewDate) {
          infoText += `  • Next Review: ${project.nextReviewDate}\n`;
        }

        if (project.lastReviewDate) {
          infoText += `  • Last Reviewed: ${project.lastReviewDate}\n`;
        }

        infoText += '\n';
      }

      return {
        content: [{
          type: "text" as const,
          text: infoText.trim()
        }]
      };
    } else {
      return {
        content: [{
          type: "text" as const,
          text: `Failed to get projects for review: ${result.error}`
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
        text: `Error getting projects for review: ${errorMessage}`
      }],
      isError: true
    };
  }
}
