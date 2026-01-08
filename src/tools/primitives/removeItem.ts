import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('removeItem');

// Interface for item removal parameters
export interface RemoveItemParams {
  id?: string;          // ID of the task or project to remove
  name?: string;        // Name of the task or project to remove (as fallback if ID not provided)
  itemType: 'task' | 'project'; // Type of item to remove
}

/**
 * Remove a task or project from OmniFocus
 * Uses OmniJS to avoid AppleScript escaping issues with special characters like $
 */
export async function removeItem(params: RemoveItemParams): Promise<{success: boolean, id?: string, name?: string, error?: string}> {
  try {
    // Validate parameters
    if (!params.id && !params.name) {
      return {
        success: false,
        error: "Either id or name must be provided"
      };
    }

    log.debug('Executing removeItem', { itemType: params.itemType, id: params.id, name: params.name });

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@removeTask.js', {
      id: params.id || null,
      name: params.name || null,
      itemType: params.itemType
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

    if (parsed.success) {
      // Invalidate cache after successful write
      queryCache.invalidateOnWrite();
      return {
        success: true,
        id: parsed.id,
        name: parsed.name
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    log.error('Error in removeItem', { error: error?.message });
    return {
      success: false,
      error: error?.message || "Unknown error in removeItem"
    };
  }
}
