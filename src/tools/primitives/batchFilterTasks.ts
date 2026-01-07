import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export interface BatchFilterTasksOptions {
  // Project filters
  projectIds?: string[];
  projectNames?: string[];

  // Task status filter
  taskStatus?: string[];

  // Due date filters
  dueToday?: boolean;
  dueThisWeek?: boolean;
  overdue?: boolean;

  // Other filters
  flagged?: boolean;

  // Output control
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function batchFilterTasks(options: BatchFilterTasksOptions = {}): Promise<string> {
  try {
    const {
      limit = 100,
      sortBy = "name",
      sortOrder = "asc"
    } = options;

    console.error("Executing batch filter for projects...");
    console.error(`Project IDs: ${options.projectIds?.join(', ') || 'none'}`);
    console.error(`Project Names: ${options.projectNames?.join(', ') || 'none'}`);

    const result = await executeOmniFocusScript('@batchFilterTasks.js', {
      ...options,
      limit,
      sortBy,
      sortOrder
    });

    if (typeof result === 'string') {
      return result;
    }

    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      return formatBatchResults(data, options);
    }

    return "Unexpected result format from OmniFocus";

  } catch (error) {
    console.error("Error in batchFilterTasks:", error);
    throw new Error(`Failed to batch filter tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function formatBatchResults(data: any, options: BatchFilterTasksOptions): string {
  let output = `# 🔍 BATCH FILTER RESULTS\n\n`;

  // Show filter summary
  const filterParts: string[] = [];
  if (options.taskStatus && options.taskStatus.length > 0) {
    filterParts.push(`Status: ${options.taskStatus.join(', ')}`);
  }
  if (options.flagged !== undefined) {
    filterParts.push(`Flagged: ${options.flagged ? 'Yes' : 'No'}`);
  }
  if (options.dueToday) filterParts.push('Due: Today');
  if (options.dueThisWeek) filterParts.push('Due: This Week');
  if (options.overdue) filterParts.push('Overdue only');

  if (filterParts.length > 0) {
    output += `**Common Filters**: ${filterParts.join(' | ')}\n\n`;
  }

  // Summary
  const projectCount = data.projectResults?.length || 0;
  const totalTasks = data.projectResults?.reduce((sum: number, p: any) => sum + (p.taskCount || 0), 0) || 0;
  output += `**Summary**: ${totalTasks} tasks across ${projectCount} projects\n\n`;
  output += `---\n\n`;

  // Results by project
  if (data.projectResults && Array.isArray(data.projectResults)) {
    for (const projectResult of data.projectResults) {
      const projectName = projectResult.projectName || 'Unknown Project';
      const taskCount = projectResult.taskCount || 0;
      const tasks = projectResult.tasks || [];

      output += `## 📁 ${projectName}\n`;
      output += `**ID**: ${projectResult.projectId || 'N/A'} | **Tasks**: ${taskCount}`;
      if (projectResult.totalCount && projectResult.totalCount > taskCount) {
        output += ` (showing ${taskCount} of ${projectResult.totalCount})`;
      }
      output += `\n\n`;

      if (tasks.length === 0) {
        output += `_No matching tasks_\n\n`;
      } else {
        for (const task of tasks) {
          output += formatTask(task);
        }
        output += '\n';
      }
    }

    // Projects not found
    if (data.notFound && data.notFound.length > 0) {
      output += `## ⚠️ Projects Not Found\n`;
      for (const nf of data.notFound) {
        output += `- ${nf}\n`;
      }
      output += '\n';
    }
  }

  return output;
}

function formatTask(task: any): string {
  let output = '';

  const flagSymbol = task.flagged ? '🚩 ' : '';
  const statusEmoji = getStatusEmoji(task.taskStatus);

  output += `${statusEmoji} ${flagSymbol}**${task.name}** [ID: ${task.id}]`;

  // Status if not Available
  if (task.taskStatus && task.taskStatus !== 'Available') {
    output += ` (${task.taskStatus})`;
  }

  output += '\n';

  // Date info
  if (task.dueDate) {
    const dueDateStr = new Date(task.dueDate).toLocaleDateString();
    const isOverdue = new Date(task.dueDate) < new Date();
    output += `  ${isOverdue ? '⚠️' : '📅'} Due: ${dueDateStr}\n`;
  }

  if (task.deferDate) {
    output += `  🚀 Defer: ${new Date(task.deferDate).toLocaleDateString()}\n`;
  }

  // Tags
  if (task.tags && task.tags.length > 0) {
    const tagNames = task.tags.map((t: any) => t.name).join(', ');
    output += `  🏷 ${tagNames}\n`;
  }

  // Note (truncated)
  if (task.note && task.note.trim()) {
    const truncatedNote = task.note.length > 100 ? task.note.slice(0, 100) + '...' : task.note;
    output += `  📝 ${truncatedNote.trim()}\n`;
  }

  return output;
}

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
