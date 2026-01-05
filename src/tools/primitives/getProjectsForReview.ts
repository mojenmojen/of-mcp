import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

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
    console.error("Executing OmniJS script for getProjectsForReview...");
    console.error(`Parameters: includeOnHold=${params.includeOnHold}, limit=${params.limit}`);

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

  } catch (error: any) {
    console.error("Error in getProjectsForReview:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in getProjectsForReview"
    };
  }
}
