import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('searchTasks');

export interface SearchTasksOptions {
  query: string;
  matchMode?: "contains" | "anyWord" | "allWords" | "exact";
  searchIn?: "all" | "name" | "note";
  includeCompleted?: boolean;
  projectName?: string;
  projectId?: string;
  limit?: number;
}

export async function searchTasks(options: SearchTasksOptions): Promise<string> {
  try {
    const {
      query,
      matchMode = "contains",
      searchIn = "all",
      includeCompleted = false,
      limit = 50
    } = options;

    const scriptParams = {
      ...options,
      matchMode,
      searchIn,
      includeCompleted,
      limit
    };

    // Check cache first
    const { data: cached, checksum } = await queryCache.getWithChecksum<SearchResult>('searchTasks', scriptParams);

    if (cached) {
      log.debug('Using cached search result');
      return formatSearchResults(cached, query, matchMode);
    }

    const result = await executeOmniFocusScript('@searchTasks.js', scriptParams);

    let parsed: SearchResult;
    if (typeof result === 'string') {
      parsed = JSON.parse(result);
    } else if (result && typeof result === 'object') {
      parsed = result as SearchResult;
    } else {
      return "Unexpected result format from OmniFocus";
    }

    // Cache the result
    await queryCache.set('searchTasks', scriptParams, parsed, checksum);

    return formatSearchResults(parsed, query, matchMode);

  } catch (error) {
    log.error('Error in searchTasks', {
      error: error instanceof Error ? error.message : String(error),
      query: options.query,
      projectName: options.projectName,
      projectId: options.projectId,
      matchMode: options.matchMode
    });
    throw new Error(`Failed to search tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

interface SearchResult {
  success: boolean;
  error?: string;
  query: string;
  matchMode: string;
  totalMatches: number;
  returned: number;
  tasks: SearchTaskResult[];
}

interface SearchTaskResult {
  id: string;
  name: string;
  matchedIn: 'name' | 'note' | 'both';
  project: string | null;
  projectId: string | null;
  dueDate: string | null;
  completed: boolean;
  flagged: boolean;
  tags: string[];
  notePreview: string | null;
}

function formatSearchResults(data: SearchResult, query: string, matchMode: string): string {
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  let output = `# 🔍 SEARCH RESULTS\n\n`;
  output += `**Query**: "${query}" (${matchMode})\n\n`;

  if (data.tasks.length === 0) {
    output += "No tasks match your search.\n";
    output += "\n**Tips**:\n";
    output += "- Try using 'anyWord' matchMode for broader results\n";
    output += "- Check spelling of search terms\n";
    output += "- Set includeCompleted: true to search completed tasks\n";
    return output;
  }

  output += `Found ${data.totalMatches} match${data.totalMatches === 1 ? '' : 'es'}`;
  if (data.returned < data.totalMatches) {
    output += ` (showing first ${data.returned})`;
  }
  output += `:\n\n`;

  // Group by project
  const tasksByProject = new Map<string, SearchTaskResult[]>();
  data.tasks.forEach(task => {
    const projectName = task.project || '📥 Inbox';
    if (!tasksByProject.has(projectName)) {
      tasksByProject.set(projectName, []);
    }
    tasksByProject.get(projectName)!.push(task);
  });

  tasksByProject.forEach((tasks, projectName) => {
    if (tasksByProject.size > 1) {
      output += `## 📁 ${projectName}\n`;
    }

    tasks.forEach(task => {
      const flagSymbol = task.flagged ? '🚩 ' : '';
      const matchIndicator = task.matchedIn === 'both' ? '📝'
        : task.matchedIn === 'note' ? '📄'
        : '';

      output += `- ${flagSymbol}${task.name} ${matchIndicator}`;
      output += ` [ID: ${task.id}]`;

      if (task.dueDate) {
        const dueDateStr = new Date(task.dueDate).toLocaleDateString();
        output += ` [📅 ${dueDateStr}]`;
      }

      output += '\n';

      if (task.notePreview && task.matchedIn !== 'name') {
        output += `  💬 "${task.notePreview}${task.notePreview.length >= 150 ? '...' : ''}"\n`;
      }

      if (task.tags.length > 0) {
        output += `  🏷 ${task.tags.join(', ')}\n`;
      }
    });

    if (tasksByProject.size > 1) {
      output += '\n';
    }
  });

  output += `\n📌 Legend: 📝 matched in both name & note, 📄 matched in note only\n`;

  return output;
}
