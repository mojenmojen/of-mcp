import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('listProjects');

export interface ListProjectsOptions {
  folderName?: string;
  folderId?: string;
  status?: 'active' | 'onHold' | 'completed' | 'dropped' | 'all';
  includeDroppedFolders?: boolean;
  limit?: number;
}

interface ProjectInfo {
  id: string;
  name: string;
  status: string;
  taskCount: number;
  folderId: string | null;
  folderName: string | null;
  nextReviewDate: string | null;
}

interface ListProjectsResult {
  success: boolean;
  count: number;
  folderFilter: string | null;
  statusFilter: string;
  projects: ProjectInfo[];
  error?: string;
}

export async function listProjects(options: ListProjectsOptions = {}): Promise<ListProjectsResult> {
  const {
    folderName,
    folderId,
    status = 'active',
    includeDroppedFolders = false,
    limit = 100
  } = options;

  try {
    log.debug('Executing OmniJS script for listProjects', {
      folderName,
      folderId,
      status,
      limit
    });

    const result = await executeOmniFocusScript('@listProjects.js', {
      folderName,
      folderId,
      status,
      includeDroppedFolders,
      limit
    });

    // Parse result
    let parsed: ListProjectsResult;
    if (typeof result === 'string') {
      try {
        parsed = JSON.parse(result);
      } catch (e) {
        log.error('Failed to parse result as JSON', { error: (e as Error).message });
        return {
          success: false,
          error: `Failed to parse result: ${result}`,
          count: 0,
          folderFilter: null,
          statusFilter: status,
          projects: []
        };
      }
    } else {
      parsed = result as ListProjectsResult;
    }

    return parsed;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error('Error in listProjects', { error: errorMsg });
    return {
      success: false,
      error: errorMsg || "Unknown error in listProjects",
      count: 0,
      folderFilter: null,
      statusFilter: status,
      projects: []
    };
  }
}
