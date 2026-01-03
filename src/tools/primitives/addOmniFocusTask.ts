import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Interface for task creation parameters
export interface AddOmniFocusTaskParams {
  name: string;
  note?: string;
  dueDate?: string; // ISO date string
  deferDate?: string; // ISO date string
  flagged?: boolean;
  estimatedMinutes?: number;
  tags?: string[]; // Tag names
  projectName?: string; // Project name to add task to
  parentTaskId?: string; // Parent task ID for subtask creation
  parentTaskName?: string; // Parent task name for subtask creation (alternative to ID)
}

/**
 * Validate parent task parameters to prevent conflicts
 */
function validateParentTaskParams(params: AddOmniFocusTaskParams): {valid: boolean, error?: string} {
  // Check if both parentTaskId and parentTaskName are provided
  if (params.parentTaskId && params.parentTaskName) {
    return {
      valid: false,
      error: "Cannot specify both parentTaskId and parentTaskName. Please use only one."
    };
  }

  // Check if parent task is specified along with projectName
  if ((params.parentTaskId || params.parentTaskName) && params.projectName) {
    return {
      valid: false,
      error: "Cannot specify both parent task and project. Subtasks inherit project from their parent."
    };
  }

  return { valid: true };
}

/**
 * Add a task to OmniFocus
 * Uses OmniJS to correctly parse ISO date formats and handle special characters
 */
export async function addOmniFocusTask(params: AddOmniFocusTaskParams): Promise<{success: boolean, taskId?: string, error?: string}> {
  try {
    // Validate parameters
    if (!params.name) {
      return {
        success: false,
        error: "Task name is required"
      };
    }

    // Validate parent task parameters
    const validation = validateParentTaskParams(params);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    console.error("Executing OmniJS script for addOmniFocusTask...");
    console.error(`Task name: ${params.name}, Project: ${params.projectName || 'inbox'}`);

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@addTask.js', {
      name: params.name,
      note: params.note || null,
      dueDate: params.dueDate || null,
      deferDate: params.deferDate || null,
      flagged: params.flagged || false,
      estimatedMinutes: params.estimatedMinutes || null,
      tags: params.tags || [],
      projectName: params.projectName || null,
      parentTaskId: params.parentTaskId || null,
      parentTaskName: params.parentTaskName || null
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
        taskId: parsed.taskId
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    console.error("Error in addOmniFocusTask:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in addOmniFocusTask"
    };
  }
}
