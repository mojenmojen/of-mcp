import { z } from 'zod';
import { getFolderById, GetFolderByIdParams } from '../primitives/getFolderById.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { formatProcessingWarnings } from '../../utils/formatUtils.js';

const log = logger.child('def:getFolderById');

export const schema = z.object({
  folderId: z.string().optional().describe("The ID of the folder to retrieve"),
  folderName: z.string().optional().describe("The name or \"Parent > Child\" path of the folder to retrieve (alternative to folderId). If it matches more than one folder, the call fails and lists each candidate's path and ID; pass folderId to choose one.")
});

export async function handler(args: z.infer<typeof schema>, _extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
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

      // Surface any optional-field read failures (issue #110)
      const warnings = formatProcessingWarnings(result.processingErrors);
      if (warnings) infoText += `\n${warnings}`;

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
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error('Tool execution error', { error: errorMessage });
    return {
      content: [{
        type: "text" as const,
        text: `Error retrieving folder: ${errorMessage}`
      }],
      isError: true
    };
  }
}
