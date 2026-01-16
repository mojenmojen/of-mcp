import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('getProjectsForReview');

// Interface for get projects for review parameters
export interface GetProjectsForReviewParams {
  includeOnHold?: boolean;
  limit?: number;
}

// Interface for project review info
export interface ProjectForReview {
  id: string;
  name: string;
  status: string;
  remainingTaskCount: number;
  folderId: string | null;
  folderName: string | null;
  reviewInterval: number | null; // seconds between reviews
  nextReviewDate: string | null; // ISO date
  lastReviewDate: string | null; // ISO date
}

/**
 * Get projects that need review from OmniFocus
 */
export async function getProjectsForReview(params: GetProjectsForReviewParams): Promise<{
  success: boolean;
  totalCount?: number;
  returnedCount?: number;
  projects?: ProjectForReview[];
  error?: string;
}> {
  try {
    log.debug('Executing OmniJS script for getProjectsForReview', {
      includeOnHold: params.includeOnHold,
      limit: params.limit
    });

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@getProjectsForReview.js', {
      includeOnHold: params.includeOnHold || false,
      limit: params.limit || 50
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
        totalCount: parsed.totalCount,
        returnedCount: parsed.returnedCount,
        projects: parsed.projects as ProjectForReview[]
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Error in getProjectsForReview', { error: errorMsg });
    return {
      success: false,
      error: errorMsg || "Unknown error in getProjectsForReview"
    };
  }
}
