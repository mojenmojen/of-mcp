import { z } from 'zod';
import { addFolder, AddFolderParams } from '../primitives/addFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export const schema = z.object({
  name: z.string().describe("The name of the folder to create"),
  parentFolderName: z.string().optional().describe("Parent folder name (creates nested folder). If omitted, creates at root level."),
  parentFolderId: z.string().optional().describe("Parent folder ID (alternative to parentFolderName)")
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) {
  try {
    // Call the addFolder function
    const result = await addFolder(args as AddFolderParams);

    if (result.success) {
      // Folder was created successfully
      let locationText = result.parentFolderName
        ? `inside "${result.parentFolderName}"`
        : "at the root level";

      return {
        content: [{
          type: "text" as const,
          text: `✅ Folder "${args.name}" created successfully ${locationText}.\nFolder ID: ${result.folderId}`
        }]
      };
    } else {
      // Folder creation failed
      return {
        content: [{
          type: "text" as const,
          text: `Failed to create folder: ${result.error}`
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
        text: `Error creating folder: ${error.message}`
      }],
      isError: true
    };
  }
}
