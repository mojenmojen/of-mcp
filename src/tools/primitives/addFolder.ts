import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Interface for folder creation parameters
export interface AddFolderParams {
  name: string;
  parentFolderName?: string; // Parent folder name (for nested folders)
  parentFolderId?: string; // Parent folder ID (alternative to parentFolderName)
}

/**
 * Add a folder to OmniFocus
 */
export async function addFolder(params: AddFolderParams): Promise<{success: boolean, folderId?: string, parentFolderName?: string | null, error?: string}> {
  try {
    // Validate parameters
    if (!params.name) {
      return {
        success: false,
        error: "Folder name is required"
      };
    }

    console.error("Executing OmniJS script for addFolder...");
    console.error(`Folder name: ${params.name}, Parent: ${params.parentFolderName || params.parentFolderId || 'root'}`);

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@addFolder.js', {
      name: params.name,
      parentFolderName: params.parentFolderName || null,
      parentFolderId: params.parentFolderId || null
    });

    // Parse result
    let parsed;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        console.error("Failed to parse result as JSON:", e);
        return {
          success: false,
          error: `Failed to parse result: ${result}`
        };
      }
    } else {
      parsed = result;
    }

    if (parsed.success) {
      return {
        success: true,
        folderId: parsed.folderId,
        parentFolderName: parsed.parentFolderName
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in addFolder:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in addFolder"
    };
  }
}
