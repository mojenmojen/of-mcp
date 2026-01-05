import { z } from 'zod';
import { listProjects } from '../primitives/listProjects.js';

export const schema = z.object({
  folderName: z.string().optional().describe("Filter by folder name"),
  folderId: z.string().optional().describe("Filter by folder ID"),
  status: z.enum(['active', 'onHold', 'completed', 'dropped', 'all']).optional()
    .describe("Filter by project status (default: active)"),
  includeDroppedFolders: z.boolean().optional()
    .describe("Include projects in dropped folders (default: false)"),
  limit: z.number().optional().describe("Maximum number of projects to return (default: 100)")
});

export async function handler(
  args: z.infer<typeof schema>,
  extra: { signal?: AbortSignal }
) {
  try {
    const result = await listProjects({
      folderName: args.folderName,
      folderId: args.folderId,
      status: args.status,
      includeDroppedFolders: args.includeDroppedFolders,
      limit: args.limit
    });

    if (!result.success) {
      return {
        content: [{
          type: "text" as const,
          text: `Error: ${result.error}`
        }]
      };
    }

    // Format output
    let output = '';

    // Header
    if (result.folderFilter) {
      output += `# Projects in "${result.folderFilter}"\n\n`;
    } else {
      output += `# All Projects\n\n`;
    }

    output += `Found **${result.count}** ${result.statusFilter} project${result.count === 1 ? '' : 's'}:\n\n`;

    if (result.projects.length === 0) {
      output += "_No projects found matching the criteria._\n";
    } else {
      // Table header
      output += "| Name | Status | Tasks | Next Review | Folder |\n";
      output += "|------|--------|-------|-------------|--------|\n";

      // Table rows
      for (const project of result.projects) {
        const reviewDate = project.nextReviewDate
          ? new Date(project.nextReviewDate).toLocaleDateString()
          : '-';
        const folderDisplay = project.folderName || '(root)';

        output += `| ${project.name} | ${project.status} | ${project.taskCount} | ${reviewDate} | ${folderDisplay} |\n`;
      }

      // IDs section
      output += "\n**Project IDs:**\n";
      for (const project of result.projects) {
        output += `- ${project.name}: \`${project.id}\`\n`;
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: output
      }]
    };

  } catch (err: any) {
    return {
      content: [{
        type: "text" as const,
        text: `Error listing projects: ${err?.message || 'Unknown error'}`
      }]
    };
  }
}
