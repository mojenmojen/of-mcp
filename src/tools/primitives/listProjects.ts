import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

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
    console.error("Executing OmniJS script for listProjects...");
    console.error(`Parameters: folderName=${folderName}, folderId=${folderId}, status=${status}, limit=${limit}`);

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
        console.error("Failed to parse result as JSON:", e);
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

  } catch (error: any) {
    console.error("Error in listProjects:", error);
    return {
      success: false,
      error: error?.message || "Unknown error in listProjects",
      count: 0,
      folderFilter: null,
      statusFilter: status,
      projects: []
    };
  }
}
