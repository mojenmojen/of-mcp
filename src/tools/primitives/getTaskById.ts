import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('getTaskById');

// Interface for task lookup parameters
export interface GetTaskByIdParams {
  taskId?: string;
  taskName?: string;
}

// Interface for task information result
export interface TaskInfo {
  id: string;
  name: string;
  note: string;
  dueDate?: string | null;
  deferDate?: string | null;
  plannedDate?: string | null;
  parentId?: string;
  parentName?: string;
  projectId?: string;
  projectName?: string;
  hasChildren: boolean;
  childrenCount: number;
  repetitionRule?: string | null; // iCal RRULE string representation
  isRepeating?: boolean;
}

/**
 * Get task information by ID or name from OmniFocus
 * Uses OmniJS to avoid AppleScript escaping issues with special characters like $
 */
export async function getTaskById(params: GetTaskByIdParams): Promise<{success: boolean, task?: TaskInfo, error?: string}> {
  try {
    // Validate parameters
    if (!params.taskId && !params.taskName) {
      return {
        success: false,
        error: "Either taskId or taskName must be provided"
      };
    }

    const scriptParams = {
      taskId: params.taskId || null,
      taskName: params.taskName || null
    };

    // Check cache first (getWithChecksum returns checksum for race-condition-free set)
    type CacheResult = {success: boolean, task?: TaskInfo, error?: string};
    const { data: cached, checksum } = await queryCache.getWithChecksum<CacheResult>('getTaskById', scriptParams);
    if (cached) {
      log.debug('Using cached result');
      return cached;
    }

    log.debug('Executing OmniJS script', { taskId: params.taskId, taskName: params.taskName });

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@getTaskByIdOrName.js', scriptParams);

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

    const response: CacheResult = parsed.success
      ? { success: true, task: parsed.task as TaskInfo }
      : { success: false, error: parsed.error || "Unknown error" };

    // Cache the result with the same checksum used for validation
    await queryCache.set('getTaskById', scriptParams, response, checksum);

    return response;

  } catch (error: any) {
    log.error('Error in getTaskById', { error: error?.message });
    return {
      success: false,
      error: error?.message || "Unknown error in getTaskById"
    };
  }
}
