import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('getTodayCompletedTasks');

export interface GetTodayCompletedTasksOptions {
  limit?: number;
}

export async function getTodayCompletedTasks(options: GetTodayCompletedTasksOptions = {}): Promise<string> {
  try {
    const { limit = 20 } = options;
    
    const result = await executeOmniFocusScript('@todayCompletedTasks.js', { limit });
    
    if (typeof result === 'string') {
      return result;
    }
    
    // If result is an object, format it
    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Format completed tasks result
      let output = `# ✅ Tasks Completed Today\n\n`;

      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += "🎯 No tasks completed today yet.\n";
          output += "\n**Keep going!** Complete some tasks to populate this list!\n";
        } else {
          const taskCount = data.tasks.length;
          const totalCount = data.filteredCount || taskCount;

          output += `🎉 Great job! Completed **${totalCount}** task${totalCount === 1 ? '' : 's'} today`;
          if (taskCount < totalCount) {
            output += ` (showing first ${taskCount})`;
          }
          output += `:\n\n`;

          // Group tasks by project
          const tasksByProject = groupTasksByProject(data.tasks);

          tasksByProject.forEach((tasks, projectName) => {
            if (tasksByProject.size > 1) {
              output += `## 📁 ${projectName}\n`;
            }

            tasks.forEach((task: any) => {
              output += formatCompletedTask(task);
              output += '\n';
            });

            if (tasksByProject.size > 1) {
              output += '\n';
            }
          });

          // Show summary
          output += `\n---\n📊 **Today's Summary**: ${totalCount} task${totalCount === 1 ? '' : 's'} completed\n`;
          output += `📅 **Query Time**: ${new Date().toLocaleString()}\n`;
        }
      } else {
        output += "Unable to retrieve task data\n";
      }

      return output;
    }

    return "Unable to parse OmniFocus result";
    
  } catch (error) {
    log.error('Error in getTodayCompletedTasks', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to get today's completed tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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

// Format a single completed task
function formatCompletedTask(task: any): string {
  let output = '';

  // Task basic info
  const flagSymbol = task.flagged ? '🚩 ' : '';

  output += `✅ ${flagSymbol}${task.name} [ID: ${task.id}]`;

  // Completion time
  if (task.completedDate) {
    const completedTime = new Date(task.completedDate).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    output += ` *(completed at ${completedTime})*`;
  }

  // Additional info
  const additionalInfo: string[] = [];

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