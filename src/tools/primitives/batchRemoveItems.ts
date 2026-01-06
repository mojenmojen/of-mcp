import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

// Define the parameters for a single item removal
export type BatchRemoveItemsParams = {
  id?: string;
  name?: string;
  itemType: 'task' | 'project';
};

// Define the result type for individual operations
type ItemResult = {
  success: boolean;
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
 * Remove multiple items (tasks or projects) from OmniFocus in a single script execution
 * This is dramatically faster than calling removeItem for each item individually
 */
export async function batchRemoveItems(items: BatchRemoveItemsParams[]): Promise<BatchResult> {
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

    console.error(`Executing batch remove for ${items.length} items...`);

    // Execute single OmniJS script with all items
    const result = await executeOmniFocusScript('@batchRemoveItems.js', { items });

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
    console.error("Error in batchRemoveItems:", error);
    return {
      success: false,
      successCount: 0,
      failureCount: items.length,
      results: [],
      error: error?.message || "Unknown error in batchRemoveItems"
    };
  }
}
