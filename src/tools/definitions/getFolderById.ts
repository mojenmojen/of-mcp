import { z } from 'zod';
import { getFolderById, GetFolderByIdParams } from '../primitives/getFolderById.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  folderId: z.string().optional().describe("The ID of the folder to retrieve"),
  folderName: z.string().optional().describe("The name of the folder to retrieve (alternative to folderId)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Validate that either folderId or folderName is provided
    if (!args.folderId && !args.folderName) {
      return {
        content: [{
          type: "text" as const,
          text: "Error: Either folderId or folderName must be provided."
        }],
        isError: true
      };
    }

    // Call the getFolderById function
    const result = await getFolderById(args as GetFolderByIdParams);

    if (result.success && result.folder) {
      const folder = result.folder;

      // Format folder information for display
      let infoText = `📂 **Folder Information**\n`;
      infoText += `• **Name**: ${folder.name}\n`;
      infoText += `• **ID**: ${folder.id}\n`;
      infoText += `• **Status**: ${folder.status}\n`;

      if (folder.parentFolderName) {
        infoText += `• **Parent Folder**: ${folder.parentFolderName}\n`;
      }

      infoText += `• **Projects**: ${folder.activeProjectCount} active (${folder.projectCount} total)\n`;
      infoText += `• **Subfolders**: ${folder.subfolderCount}\n`;

      return {
        content: [{
          type: "text" as const,
          text: infoText
        }]
      };
    } else {
      // Folder retrieval failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to retrieve folder: ${result.error}`
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
        text: `Error retrieving folder: ${error.message}`
      }],
      isError: true
    };
  }
}
