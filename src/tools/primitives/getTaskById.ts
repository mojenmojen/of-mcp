import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

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

    console.error("Executing OmniJS script for getTaskById...");
    console.error(`Parameters: taskId=${params.taskId}, taskName=${params.taskName}`);

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@getTaskByIdOrName.js', {
      taskId: params.taskId || null,
      taskName: params.taskName || null
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
        task: parsed.task as TaskInfo
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in getTaskById:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in getTaskById"
    };
  }
}
