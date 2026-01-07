import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Interface for project creation parameters
export interface AddProjectParams {
  name: string;
  note?: string;
  dueDate?: string; // ISO date string
  deferDate?: string; // ISO date string
  flagged?: boolean;
  estimatedMinutes?: number;
  tags?: string[]; // Tag names
  folderName?: string; // Folder name to add project to
  folderId?: string; // Folder ID to add project to (alternative to folderName)
  sequential?: boolean; // Whether tasks should be sequential or parallel
}

/**
 * Add a project to OmniFocus
 * Uses OmniJS to correctly parse ISO date formats and handle special characters
 */
export async function addProject(params: AddProjectParams): Promise<{success: boolean, projectId?: string, error?: string}> {
  try {
    // Validate parameters
    if (!params.name) {
      return {
        success: false,
        error: "Project name is required"
      };
    }

    console.error("Executing OmniJS script for addProject...");
    const folderInfo = params.folderId ? `ID:${params.folderId}` : (params.folderName || 'root');
    console.error(`Project name: ${params.name}, Folder: ${folderInfo}`);

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@addProject.js', {
      name: params.name,
      note: params.note || null,
      dueDate: params.dueDate || null,
      deferDate: params.deferDate || null,
      flagged: params.flagged || false,
      estimatedMinutes: params.estimatedMinutes || null,
      tags: params.tags || [],
      folderName: params.folderName || null,
      folderId: params.folderId || null,
      sequential: params.sequential || false
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
        projectId: parsed.projectId
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in addProject:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in addProject"
    };
  }
}
