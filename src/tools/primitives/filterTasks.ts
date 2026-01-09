import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('filterTasks');

export interface FilterTasksOptions {
  // Task status filter
  taskStatus?: string[];

  // Perspective scope
  perspective?: "inbox" | "flagged" | "all" | "custom";

  // Custom perspective parameters
  customPerspectiveName?: string;
  customPerspectiveId?: string;

  // Project/tag filter
  projectFilter?: string;
  projectId?: string;
  tagFilter?: string | string[];
  tagId?: string | string[];
  exactTagMatch?: boolean;
  untagged?: boolean;

  // Due date filter
  dueBefore?: string;
  dueAfter?: string;
  dueToday?: boolean;
  dueThisWeek?: boolean;
  dueThisMonth?: boolean;
  overdue?: boolean;

  // Defer date filter
  deferBefore?: string;
  deferAfter?: string;
  deferToday?: boolean;
  deferThisWeek?: boolean;
  deferAvailable?: boolean;

  // Planned date filter
  plannedBefore?: string;
  plannedAfter?: string;
  plannedToday?: boolean;
  plannedThisWeek?: boolean;

  // Completed date filter
  completedBefore?: string;
  completedAfter?: string;
  completedToday?: boolean;
  completedYesterday?: boolean;
  completedThisWeek?: boolean;
  completedThisMonth?: boolean;

  // Other filters
  flagged?: boolean;
  searchText?: string;
  hasEstimate?: boolean;
  estimateMin?: number;
  estimateMax?: number;
  hasNote?: boolean;
  inInbox?: boolean;

  // Output control
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function filterTasks(options: FilterTasksOptions = {}): Promise<string> {
  try {
    // Set default values
    const {
      perspective = "all",
      exactTagMatch = false,
      limit = 100,
      sortBy = "name",
      sortOrder = "asc"
    } = options;

    const scriptParams = {
      ...options,
      perspective,
      exactTagMatch,
      limit,
      sortBy,
      sortOrder
    };

    // Check cache first (getWithChecksum returns checksum for race-condition-free set)
    const { data: cached, checksum } = await queryCache.getWithChecksum<unknown>('filterTasks', scriptParams);
    let result: unknown;

    if (cached) {
      log.debug('Using cached result');
      result = cached;
    } else {
      // Execute filter script
      result = await executeOmniFocusScript('@filterTasks.js', scriptParams);
      // Cache the result with the same checksum used for validation
      await queryCache.set('filterTasks', scriptParams, result, checksum);
    }

    if (typeof result === 'string') {
      return result;
    }

    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Format filter results
      let output = `# 🔍 FILTERED TASKS\n\n`;

      // Show filter summary
      const filterSummary = buildFilterSummary(options);
      if (filterSummary) {
        output += `**Filter**: ${filterSummary}\n\n`;
      }

      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += "🎯 No tasks match your filter criteria.\n";

          // Provide suggestions
          output += "\n**Tips**:\n";
          output += "- Try broadening your search criteria\n";
          output += "- Check if tasks exist in the specified project/tags\n";
          output += "- Use `get_inbox_tasks` or `get_flagged_tasks` for basic views\n";
        } else {
          const taskCount = data.tasks.length;
          const totalCount = data.totalCount || taskCount;

          output += `Found ${taskCount} task${taskCount === 1 ? '' : 's'}`;
          if (taskCount < totalCount) {
            output += ` (showing first ${taskCount} of ${totalCount})`;
          }
          output += `:\n\n`;

          // Group tasks by project
          const tasksByProject = groupTasksByProject(data.tasks);

          tasksByProject.forEach((tasks, projectName) => {
            if (tasksByProject.size > 1) {
              output += `## 📁 ${projectName}\n`;
            }

            tasks.forEach((task: any) => {
              output += formatTask(task);
              output += '\n';
            });

            if (tasksByProject.size > 1) {
              output += '\n';
            }
          });

          // Show sort info
          if (data.sortedBy) {
            output += `\n📊 **Sorted by**: ${data.sortedBy} (${data.sortOrder || 'asc'})\n`;
          }
        }
      } else {
        output += "No task data available\n";
      }

      return output;
    }

    return "Unexpected result format from OmniFocus";

  } catch (error) {
    log.error('Error in filterTasks', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to filter tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Build filter summary
function buildFilterSummary(options: FilterTasksOptions): string {
  const conditions: string[] = [];
  
  if (options.taskStatus && options.taskStatus.length > 0) {
    conditions.push(`Status: ${options.taskStatus.join(', ')}`);
  }
  
  if (options.perspective && options.perspective !== 'all') {
    conditions.push(`Perspective: ${options.perspective}`);
  }
  
  if (options.projectFilter) {
    conditions.push(`Project: "${options.projectFilter}"`);
  }
  
  if (options.tagFilter) {
    const tags = Array.isArray(options.tagFilter) ? options.tagFilter.join(', ') : options.tagFilter;
    conditions.push(`Tags: ${tags}`);
  }

  if (options.untagged) {
    conditions.push('Untagged: Yes');
  }

  if (options.flagged !== undefined) {
    conditions.push(`Flagged: ${options.flagged ? 'Yes' : 'No'}`);
  }
  
  if (options.dueToday) conditions.push('Due: Today');
  else if (options.dueThisWeek) conditions.push('Due: This Week');
  else if (options.dueThisMonth) conditions.push('Due: This Month');
  else if (options.overdue) conditions.push('Due: Overdue');
  
  if (options.completedToday) conditions.push('Completed: Today');
  else if (options.completedYesterday) conditions.push('Completed: Yesterday');
  else if (options.completedThisWeek) conditions.push('Completed: This Week');
  else if (options.completedThisMonth) conditions.push('Completed: This Month');
  
  if (options.deferAvailable) conditions.push('Defer: Available');
  else if (options.deferToday) conditions.push('Defer: Today');
  else if (options.deferThisWeek) conditions.push('Defer: This Week');

  if (options.plannedToday) conditions.push('Planned: Today');
  else if (options.plannedThisWeek) conditions.push('Planned: This Week');

  if (options.estimateMin !== undefined || options.estimateMax !== undefined) {
    let estimate = 'Estimate: ';
    if (options.estimateMin !== undefined && options.estimateMax !== undefined) {
      estimate += `${options.estimateMin}-${options.estimateMax}min`;
    } else if (options.estimateMin !== undefined) {
      estimate += `≥${options.estimateMin}min`;
    } else {
      estimate += `≤${options.estimateMax}min`;
    }
    conditions.push(estimate);
  }
  
  if (options.searchText) {
    conditions.push(`Search: "${options.searchText}"`);
  }
  
  return conditions.length > 0 ? conditions.join(' | ') : '';
}

// Group tasks by project
function groupTasksByProject(tasks: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();

  tasks.forEach(task => {
    const projectName = task.projectName || (task.inInbox ? '📥 Inbox' : '📂 No Project');

    if (!grouped.has(projectName)) {
      grouped.set(projectName, []);
    }
    grouped.get(projectName)!.push(task);
  });

  return grouped;
}

// Format a single task
function formatTask(task: any): string {
  let output = '';

  // Task basic info
  const flagSymbol = task.flagged ? '🚩 ' : '';
  const statusEmoji = getStatusEmoji(task.taskStatus);

  output += `${statusEmoji} ${flagSymbol}${task.name}`;

  // Add task ID for easy reference (useful for edit_item, remove_item operations)
  if (task.id) {
    output += ` [ID: ${task.id}]`;
  }

  // Date info
  const dateInfo: string[] = [];
  if (task.dueDate) {
    const dueDateStr = new Date(task.dueDate).toLocaleDateString();
    const isOverdue = new Date(task.dueDate) < new Date();
    dateInfo.push(isOverdue ? `⚠️ DUE: ${dueDateStr}` : `📅 DUE: ${dueDateStr}`);
  }

  if (task.deferDate) {
    const deferDateStr = new Date(task.deferDate).toLocaleDateString();
    dateInfo.push(`🚀 DEFER: ${deferDateStr}`);
  }

  if (task.plannedDate) {
    const plannedDateStr = new Date(task.plannedDate).toLocaleDateString();
    dateInfo.push(`📋 PLANNED: ${plannedDateStr}`);
  }

  if (task.completedDate) {
    const completedDateStr = new Date(task.completedDate).toLocaleDateString();
    dateInfo.push(`✅ DONE: ${completedDateStr}`);
  }

  if (dateInfo.length > 0) {
    output += ` [${dateInfo.join(', ')}]`;
  }

  // Additional info
  const additionalInfo: string[] = [];

  if (task.taskStatus && task.taskStatus !== 'Available') {
    additionalInfo.push(task.taskStatus);
  }

  if (task.estimatedMinutes) {
    const hours = Math.floor(task.estimatedMinutes / 60);
    const minutes = task.estimatedMinutes % 60;
    if (hours > 0) {
      additionalInfo.push(`⏱ ${hours}h${minutes > 0 ? `${minutes}m` : ''}`);
    } else {
      additionalInfo.push(`⏱ ${minutes}m`);
    }
  }

  if (additionalInfo.length > 0) {
    output += ` (${additionalInfo.join(', ')})`;
  }

  output += '\n';

  // Task note
  if (task.note && task.note.trim()) {
    output += `  📝 ${task.note.trim()}\n`;
  }

  // Tags
  if (task.tags && task.tags.length > 0) {
    const tagNames = task.tags.map((tag: any) => tag.name).join(', ');
    output += `  🏷 ${tagNames}\n`;
  }

  return output;
}

// Get emoji for status
function getStatusEmoji(status: string): string {
  const statusMap: { [key: string]: string } = {
    'Available': '⚪',
    'Next': '🔵',
    'Blocked': '🔴',
    'DueSoon': '🟡',
    'Overdue': '🔴',
    'Completed': '✅',
    'Dropped': '⚫'
  };
  
  return statusMap[status] || '⚪';
}