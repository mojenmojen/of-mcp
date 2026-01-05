import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Interface for project lookup parameters
export interface GetProjectByIdParams {
  projectId?: string;
  projectName?: string;
}

// Interface for project information result
export interface ProjectInfo {
  id: string;
  name: string;
  note: string;
  status: string;
  sequential: boolean;
  flagged: boolean;
  dueDate: string | null;
  deferDate: string | null;
  estimatedMinutes: number | null;
  completedByChildren: boolean;
  containsSingletonActions: boolean;
  taskCount: number;
  remainingTaskCount: number;
  folderId: string | null;
  folderName: string | null;
  // Review fields
  reviewInterval: number | null; // seconds between reviews
  nextReviewDate: string | null; // ISO date
  lastReviewDate: string | null; // ISO date
}

/**
 * Get project information by ID or name from OmniFocus
 */
export async function getProjectById(params: GetProjectByIdParams): Promise<{success: boolean, project?: ProjectInfo, error?: string}> {
  try {
    // Validate parameters
    if (!params.projectId && !params.projectName) {
      return {
        success: false,
        error: "Either projectId or projectName must be provided"
      };
    }

    console.error("Executing OmniJS script for getProjectById...");
    console.error(`Parameters: projectId=${params.projectId}, projectName=${params.projectName}`);

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@getProjectByName.js', {
      projectId: params.projectId || null,
      projectName: params.projectName || null
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
        project: parsed.project as ProjectInfo
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in getProjectById:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in getProjectById"
    };
  }
}
