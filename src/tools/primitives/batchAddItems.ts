import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { RepetitionRule } from './addOmniFocusTask.js';

// Define the parameters for a single item in the batch
export type BatchAddItemsParams = {
  type: 'task' | 'project';
  name: string;
  note?: string;
  dueDate?: string;
  deferDate?: string;
  plannedDate?: string;
  flagged?: boolean;
  estimatedMinutes?: number;
  tags?: string[];
  projectName?: string; // For tasks
  projectId?: string; // For tasks (alternative to projectName)
  parentTaskId?: string; // For subtasks
  parentTaskName?: string; // For subtasks (alternative to ID)
  folderName?: string; // For projects
  folderId?: string; // For projects (alternative to folderName)
  sequential?: boolean; // For projects
  repetitionRule?: RepetitionRule; // For tasks
};

// Define the result type for individual operations
type ItemResult = {
  success: boolean;
  type?: string;
  id?: string;
  name?: string;
  error?: string;
};

// Define the result type for the batch operation
type BatchResult = {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: ItemResult[];
  error?: string;
};

/**
 * Add multiple items (tasks or projects) to OmniFocus in a single script execution
 * This is dramatically faster than calling addTask/addProject for each item individually
 */
export async function batchAddItems(items: BatchAddItemsParams[]): Promise<BatchResult> {
  try {
    if (!items || items.length === 0) {
      return {
        success: false,
        successCount: 0,
        failureCount: 0,
        results: [],
        error: "No items provided"
      };
    }

    console.error(`Executing batch add for ${items.length} items...`);

    // Execute single OmniJS script with all items
    const result = await executeOmniFocusScript('@batchAddItems.js', { items });

    // Parse result
    let parsed;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        console.error("Failed to parse result as JSON:", e);
        return {
          success: false,
          successCount: 0,
          failureCount: items.length,
          results: [],
          error: `Failed to parse result: ${result}`
        };
      }
    } else {
      parsed = result;
    }

    return {
      success: parsed.success,
      successCount: parsed.successCount || 0,
      failureCount: parsed.failureCount || 0,
      results: parsed.results || [],
      error: parsed.error
    };

  } catch (error: any) {
    console.error("Error in batchAddItems:", error);
    return {
      success: false,
      successCount: 0,
      failureCount: items.length,
      results: [],
      error: error?.message || "Unknown error in batchAddItems"
    };
  }
}
