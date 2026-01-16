import { PerspectiveEngine, TaskItem } from '../../utils/perspectiveEngine.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('getPerspectiveTasksV2');

// Perspective access interface based on OmniFocus 4.2+ new API

export interface GetPerspectiveTasksV2Params {
  perspectiveName: string;
  hideCompleted?: boolean;
  limit?: number;
}

export interface GetPerspectiveTasksV2Result {
  success: boolean;
  tasks?: TaskItem[];
  perspectiveInfo?: {
    name: string;
    rulesCount: number;
    aggregation: string;
  };
  error?: string;
}

/**
 * Get filtered tasks from perspective - V2 version
 * Uses OmniFocus 4.2+ new archivedFilterRules API
 *
 * Key advantages:
 * - 100% accuracy: Gets truly perspective-filtered tasks, not all data
 * - Zero configuration: Uses user's existing perspective settings directly
 * - Full support: Supports all 27 filter rule types and 3 aggregation methods
 */
export async function getPerspectiveTasksV2(
  params: GetPerspectiveTasksV2Params
): Promise<GetPerspectiveTasksV2Result> {

  log.debug('Starting to get tasks for perspective', {
    perspectiveName: params.perspectiveName,
    hideCompleted: params.hideCompleted,
    limit: params.limit
  });

  try {
    // Create perspective engine instance
    const engine = new PerspectiveEngine();

    // Execute perspective filtering
    const result = await engine.getFilteredTasks(params.perspectiveName, {
      hideCompleted: params.hideCompleted,
      limit: params.limit
    });

    if (!result.success) {
      log.error('Execution failed', { error: result.error });
      return {
        success: false,
        error: result.error
      };
    }

    log.debug('Execution successful', {
      perspectiveInfo: result.perspectiveInfo,
      taskCount: result.tasks?.length || 0
    });

    // Log detailed task info for debugging
    if (result.tasks && result.tasks.length > 0) {
      log.debug('Task sample', {
        first: {
          name: result.tasks[0].name,
          flagged: result.tasks[0].flagged,
          dueDate: result.tasks[0].dueDate,
          projectName: result.tasks[0].projectName,
          tagCount: result.tasks[0].tags?.length || 0
        }
      });
    }

    return {
      success: true,
      tasks: result.tasks,
      perspectiveInfo: result.perspectiveInfo
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Perspective engine error', { error: errorMsg });

    return {
      success: false,
      error: `Perspective engine error: ${errorMsg}`
    };
  }
}