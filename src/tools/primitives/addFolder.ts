import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('addFolder');

// Interface for folder creation parameters
export interface AddFolderParams {
  name: string;
  parentFolderName?: string; // Parent folder name (for nested folders)
  parentFolderId?: string; // Parent folder ID (alternative to parentFolderName)
}

/**
 * Add a folder to OmniFocus
 */
export async function addFolder(params: AddFolderParams): Promise<{success: boolean, folderId?: string, parentFolderName?: string | null, error?: string}> {
  try {
    // Validate parameters
    if (!params.name) {
      return {
        success: false,
        error: "Folder name is required"
      };
    }

    log.debug('Executing addFolder', { name: params.name, parent: params.parentFolderName || params.parentFolderId || 'root' });

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@addFolder.js', {
      name: params.name,
      parentFolderName: params.parentFolderName || null,
      parentFolderId: params.parentFolderId || null
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
        folderId: parsed.folderId,
        parentFolderName: parsed.parentFolderName
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    log.error('Error in addFolder', { error: error?.message });
    return {
      success: false,
      error: error?.message || "Unknown error in addFolder"
    };
  }
}
