import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('addProject');

// Interface for project creation parameters
export interface AddProjectParams {
  name: string;
  note?: string;
  dueDate?: string; // ISO date string
  deferDate?: string; // ISO date string
  flagged?: boolean;
  estimatedMinutes?: number;
  tags?: string[]; // Tag names
  folderName?: string; // Folder name to add project to
  folderId?: string; // Folder ID to add project to (alternative to folderName)
  sequential?: boolean; // Whether tasks should be sequential or parallel
}

/**
 * Add a project to OmniFocus
 * Uses OmniJS to correctly parse ISO date formats and handle special characters
 */
export async function addProject(params: AddProjectParams): Promise<{success: boolean, projectId?: string, error?: string}> {
  try {
    // Validate parameters
    if (!params.name) {
      return {
        success: false,
        error: "Project name is required"
      };
    }

    const folderInfo = params.folderId ? `ID:${params.folderId}` : (params.folderName || 'root');
    log.debug('Executing addProject', { name: params.name, folder: folderInfo });

    // Execute the OmniJS script
    const result = await executeOmniFocusScript('@addProject.js', {
      name: params.name,
      note: params.note || null,
      dueDate: params.dueDate || null,
      deferDate: params.deferDate || null,
      flagged: params.flagged || false,
      estimatedMinutes: params.estimatedMinutes || null,
      tags: params.tags || [],
      folderName: params.folderName || null,
      folderId: params.folderId || null,
      sequential: params.sequential || false
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
        projectId: parsed.projectId
      };
    } else {
      return {
        success: false,
        error: parsed.error || "Unknown error"
      };
    }

  } catch (error: any) {
    log.error('Error in addProject', { error: error?.message });
    return {
      success: false,
      error: error?.message || "Unknown error in addProject"
    };
  }
}
