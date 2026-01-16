import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('getProjectById');

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

    log.debug('Executing OmniJS script for getProjectById', {
      projectId: params.projectId,
      projectName: params.projectName
    });

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
        log.error('Failed to parse result as JSON', { error: (e as Error).message });
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

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Error in getProjectById', { error: errorMsg });
    return {
      success: false,
      error: errorMsg || "Unknown error in getProjectById"
    };
  }
}
