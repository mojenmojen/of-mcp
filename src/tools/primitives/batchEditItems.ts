import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { RepetitionRule } from './addOmniFocusTask.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('batchEditItems');

// Status options for tasks and projects
type TaskStatus = 'incomplete' | 'completed' | 'dropped';
type ProjectStatus = 'active' | 'completed' | 'dropped' | 'onHold';

// Interface for a single edit operation
export interface BatchEditItemParams {
  id?: string;
  name?: string;
  itemType: 'task' | 'project';

  // Common editable fields
  newName?: string;
  newNote?: string;
  newDueDate?: string;
  newDeferDate?: string;
  newPlannedDate?: string;
  newFlagged?: boolean;
  newEstimatedMinutes?: number;

  // Task-specific fields
  newStatus?: TaskStatus;
  dropCompletely?: boolean;
  addTags?: string[];
  removeTags?: string[];
  replaceTags?: string[];
  newRepetitionRule?: RepetitionRule | null;

  // Task movement fields
  newProjectName?: string;
  newParentTaskId?: string;
  newParentTaskName?: string;
  moveToInbox?: boolean;

  // Project-specific fields
  newSequential?: boolean;
  newFolderName?: string;
  newProjectStatus?: ProjectStatus;

  // Project review fields
  markReviewed?: boolean;
}

// Result for a single edit operation
interface EditResult {
  success: boolean;
  id?: string;
  name?: string;
  changedProperties?: string;
  error?: string;
}

// Result for the batch operation
interface BatchEditResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: EditResult[];
  error?: string;
}

/**
 * Edit multiple items in OmniFocus in a single script execution
 * This is dramatically faster than calling editItem for each item individually
 */
export async function batchEditItems(edits: BatchEditItemParams[]): Promise<BatchEditResult> {
  try {
    if (!edits || edits.length === 0) {
      return {
        success: false,
        successCount: 0,
        failureCount: 0,
        results: [],
        error: "No edits provided"
      };
    }

    log.debug(`Executing batch edit for ${edits.length} items`);

    // Execute single OmniJS script with all edits
    const result = await executeOmniFocusScript('@batchEditItems.js', { edits });

    // Parse result
    let parsed;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        log.error('Failed to parse result as JSON', { error: (e as Error).message });
        return {
          success: false,
          successCount: 0,
          failureCount: edits.length,
          results: [],
          error: `Failed to parse result: ${result}`
        };
      }
    } else {
      parsed = result;
    }

    // Invalidate cache if any items were successfully edited
    if (parsed.successCount > 0) {
      queryCache.invalidateOnWrite();
    }

    return {
      success: parsed.success,
      successCount: parsed.successCount || 0,
      failureCount: parsed.failureCount || 0,
      results: parsed.results || [],
      error: parsed.error
    };

  } catch (error: any) {
    log.error('Error in batchEditItems', { error: error?.message });
    return {
      success: false,
      successCount: 0,
      failureCount: edits.length,
      results: [],
      error: error?.message || "Unknown error in batchEditItems"
    };
  }
}
