import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Interface for folder lookup parameters
export interface GetFolderByIdParams {
  folderId?: string;
  folderName?: string;
}

// Interface for folder information result
export interface FolderInfo {
  id: string;
  name: string;
  status: string;
  projectCount: number;
  activeProjectCount: number;
  subfolderCount: number;
  parentFolderId: string | null;
  parentFolderName: string | null;
}

/**
 * Get folder information by ID or name from OmniFocus
 */
export async function getFolderById(params: GetFolderByIdParams): Promise<{success: boolean, folder?: FolderInfo, error?: string}> {
  try {
    // Validate parameters
    if (!params.folderId && !params.folderName) {
      return {
        success: false,
        error: "Either folderId or folderName must be provided"
      };
    }

    console.error("Executing OmniJS script for getFolderById...");
    console.error(`Parameters: folderId=${params.folderId}, folderName=${params.folderName}`);

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@getFolderByName.js', {
      folderId: params.folderId || null,
      folderName: params.folderName || null
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
        folder: parsed.folder as FolderInfo
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in getFolderById:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in getFolderById"
    };
  }
}
