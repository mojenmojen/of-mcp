import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { RepetitionRule } from './addOmniFocusTask.js';
import { createValidationError, isStructuredError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('batchAddItems');

/**
 * Detect cycles in parent-child relationships using tempId/parentTempId
 * Uses DFS with three states: unvisited, visiting (in current path), visited (complete)
 * Returns the cycle path if found, or null if no cycles exist
 */
function detectCycles(items: BatchAddItemsParams[]): string[] | null {
  // Build adjacency map: tempId -> parentTempId
  const parentMap = new Map<string, string>();
  const itemNames = new Map<string, string>();

  for (const item of items) {
    if (item.tempId) {
      itemNames.set(item.tempId, item.name);
      if (item.parentTempId) {
        parentMap.set(item.tempId, item.parentTempId);
      }
    }
  }

  // DFS cycle detection
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(nodeId: string, path: string[]): string[] | null {
    if (visiting.has(nodeId)) {
      // Found cycle - return the path from cycle start
      const cycleStart = path.indexOf(nodeId);
      return [...path.slice(cycleStart), nodeId];
    }

    if (visited.has(nodeId)) {
      return null; // Already fully explored, no cycle through this node
    }

    visiting.add(nodeId);
    path.push(nodeId);

    const parentId = parentMap.get(nodeId);
    if (parentId && itemNames.has(parentId)) {
      // Only follow if parent is also in the batch (has a tempId defined)
      const cycle = dfs(parentId, path);
      if (cycle) return cycle;
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    path.pop();

    return null;
  }

  // Check each node that has a parent reference
  for (const [tempId] of parentMap) {
    if (!visited.has(tempId)) {
      const cycle = dfs(tempId, []);
      if (cycle) {
        // Convert tempIds to names for readable error message
        return cycle.map(id => itemNames.get(id) || id);
      }
    }
  }

  return null;
}

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
  parentTaskId?: string; // For subtasks (reference to existing task)
  parentTaskName?: string; // For subtasks (alternative to ID)
  tempId?: string; // Temporary ID for referencing this item within the batch
  parentTempId?: string; // Reference to another item's tempId for hierarchical creation
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

    // Check for cycles in tempId/parentTempId relationships
    const cycle = detectCycles(items);
    if (cycle) {
      const cycleStr = cycle.join(' → ');
      log.warn('Cycle detected in batch items', { cycle: cycleStr });
      throw createValidationError(
        `Circular parent reference detected: ${cycleStr}`,
        'Remove the circular dependency between items'
      );
    }

    log.debug(`Executing batch add for ${items.length} items`);

    // Execute single OmniJS script with all items
    const result = await executeOmniFocusScript('@batchAddItems.js', { items });

    // Parse result
    let parsed;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        log.error('Failed to parse result as JSON', { error: (e as Error).message, result: result.substring(0, 200) });
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

    log.debug('Batch add completed', { successCount: parsed.successCount, failureCount: parsed.failureCount });

    return {
      success: parsed.success,
      successCount: parsed.successCount || 0,
      failureCount: parsed.failureCount || 0,
      results: parsed.results || [],
      error: parsed.error
    };

  } catch (error: any) {
    // Handle both StructuredError and regular Error
    const errorMessage = isStructuredError(error)
      ? error.error.message
      : (error?.message || "Unknown error in batchAddItems");
    log.error('Error in batchAddItems', { error: errorMessage });
    return {
      success: false,
      successCount: 0,
      failureCount: items.length,
      results: [],
      error: errorMessage
    };
  }
}
