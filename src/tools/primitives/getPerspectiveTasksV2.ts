import { PerspectiveEngine, TaskItem } from '../../utils/perspectiveEngine.js';

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

  console.log(`[PerspectiveV2] Starting to get tasks for perspective "${params.perspectiveName}"`);
  console.log(`[PerspectiveV2] Parameters:`, {
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
      console.error(`[PerspectiveV2] Execution failed:`, result.error);
      return {
        success: false,
        error: result.error
      };
    }

    console.log(`[PerspectiveV2] Execution successful`);
    console.log(`[PerspectiveV2] Perspective info:`, result.perspectiveInfo);
    console.log(`[PerspectiveV2] Filtered ${result.tasks?.length || 0} tasks`);

    // Log detailed task info for debugging
    if (result.tasks && result.tasks.length > 0) {
      console.log(`[PerspectiveV2] Task sample:`, {
        first: {
          name: result.tasks[0].name,
          flagged: result.tasks[0].flagged,
          dueDate: result.tasks[0].dueDate,
          projectName: result.tasks[0].projectName,
          tags: result.tasks[0].tags?.length || 0
        }
      });
    }

    return {
      success: true,
      tasks: result.tasks,
      perspectiveInfo: result.perspectiveInfo
    };

  } catch (error: any) {
    console.error(`[PerspectiveV2] Perspective engine error:`, error);

    return {
      success: false,
      error: `Perspective engine error: ${error.message || 'Unknown error'}`
    };
  }
}