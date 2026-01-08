import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('batchMarkReviewed');

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

    log.debug('Executing batchMarkReviewed', {
      projectIdCount: params.projectIds?.length || 0,
      projectNameCount: params.projectNames?.length || 0
    });

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
        log.error('Failed to parse result as JSON', { error: (e as Error).message });
        return {
          success: false,
          error: `Failed to parse result: ${result}`
        };
      }
    } else {
      parsed = result;
    }

    // Invalidate cache if any projects were successfully marked as reviewed
    if (parsed.successCount > 0) {
      queryCache.invalidateOnWrite();
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
    log.error('Error in batchMarkReviewed', { error: error?.message });
    return {
      success: false,
      error: error?.message || "Unknown error in batchMarkReviewed"
    };
  }
}
