import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Interface for batch mark reviewed parameters
export interface BatchMarkReviewedParams {
  projectIds?: string[];
  projectNames?: string[];
}

// Interface for individual result
export interface MarkReviewedResult {
  id: string;
  name?: string;
  success: boolean;
  nextReviewDate?: string | null;
  error?: string;
}

/**
 * Batch mark multiple projects as reviewed in OmniFocus
 */
export async function batchMarkReviewed(params: BatchMarkReviewedParams): Promise<{
  success: boolean;
  totalCount?: number;
  successCount?: number;
  failCount?: number;
  results?: MarkReviewedResult[];
  error?: string;
}> {
  try {
    const hasIds = params.projectIds && params.projectIds.length > 0;
    const hasNames = params.projectNames && params.projectNames.length > 0;

    if (!hasIds && !hasNames) {
      return {
        success: false,
        error: "Must provide either projectIds or projectNames"
      };
    }

    console.error("Executing OmniJS script for batchMarkReviewed...");
    if (hasIds) {
      console.error(`Project IDs: ${params.projectIds!.join(', ')}`);
    }
    if (hasNames) {
      console.error(`Project Names: ${params.projectNames!.join(', ')}`);
    }

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@batchMarkReviewed.js', {
      projectIds: params.projectIds,
      projectNames: params.projectNames
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

    return {
      success: parsed.success,
      totalCount: parsed.totalCount,
      successCount: parsed.successCount,
      failCount: parsed.failCount,
      results: parsed.results as MarkReviewedResult[],
      error: parsed.error
    };

  } catch (error: any) {
    console.error("Error in batchMarkReviewed:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in batchMarkReviewed"
    };
  }
}
