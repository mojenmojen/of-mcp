import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export interface GetTasksByTagOptions {
  tagName: string | string[];
  tagMatchMode?: 'any' | 'all';
  hideCompleted?: boolean;
  exactMatch?: boolean;
}

export async function getTasksByTag(options: GetTasksByTagOptions): Promise<string> {
  const { tagName, tagMatchMode = 'any', hideCompleted = true, exactMatch = false } = options;

  // Normalize to array
  const tagNames = Array.isArray(tagName) ? tagName : [tagName];
  const trimmedTagNames = tagNames.map(t => t.trim()).filter(t => t !== '');

  if (trimmedTagNames.length === 0) {
    throw new Error('At least one tag name is required');
  }

  try {
    // Execute the tasks by tag script
    const result = await executeOmniFocusScript('@tasksByTag.js', {
      tagName: trimmedTagNames,
      tagMatchMode: tagMatchMode,
      hideCompleted: hideCompleted,
      exactMatch: exactMatch
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

      // Format the tasks by tag
      const searchType = exactMatch ? 'exact match' : 'partial match';
      const searchTagsDisplay = trimmedTagNames.length === 1
        ? `"${trimmedTagNames[0]}"`
        : `[${trimmedTagNames.map(t => `"${t}"`).join(', ')}]`;
      const modeDisplay = trimmedTagNames.length > 1 ? ` (${tagMatchMode === 'all' ? 'ALL tags' : 'ANY tag'})` : '';

      let output = `# 🏷 TASKS WITH TAG: ${searchTagsDisplay}${modeDisplay} (${searchType})\n\n`;

      // Show matched tags per search term
      if (data.matchedTagsBySearchTerm && Object.keys(data.matchedTagsBySearchTerm).length > 0) {
        const entries = Object.entries(data.matchedTagsBySearchTerm);
        if (entries.length === 1) {
          const [term, tags] = entries[0] as [string, string[]];
          if (tags.length > 0) {
            output += `**Matched tags**: ${tags.join(', ')}\n\n`;
          }
        } else {
          output += `**Matched tags by search term**:\n`;
          entries.forEach(([term, tags]) => {
            const tagList = (tags as string[]).length > 0 ? (tags as string[]).join(', ') : '(none)';
            output += `- "${term}": ${tagList}\n`;
          });
          output += '\n';
        }
      }
      
      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += `No tasks found with tag ${searchTagsDisplay}\n`;
          if (data.availableTags && data.availableTags.length > 0) {
            output += `\n**Available tags**: ${data.availableTags.slice(0, 10).join(', ')}`;
            if (data.availableTags.length > 10) {
              output += ` ... and ${data.availableTags.length - 10} more`;
            }
            output += '\n';
          }
        } else {
          const taskCount = data.tasks.length;
          output += `Found ${taskCount} task${taskCount === 1 ? '' : 's'}:\n\n`;
          
          // Group tasks by project for better organization
          const tasksByProject = new Map<string, any[]>();
          
          data.tasks.forEach((task: any) => {
            const projectName = task.projectName || '📥 Inbox';
            if (!tasksByProject.has(projectName)) {
              tasksByProject.set(projectName, []);
            }
            tasksByProject.get(projectName)!.push(task);
          });
          
          // Display tasks grouped by project
          tasksByProject.forEach((tasks, projectName) => {
            if (tasksByProject.size > 1) {
              output += `## 📁 ${projectName}\n`;
            }
            
            tasks.forEach((task: any) => {
              const flagSymbol = task.flagged ? '🚩 ' : '';
              const dueDateStr = task.dueDate ? ` [DUE: ${new Date(task.dueDate).toLocaleDateString()}]` : '';
              const deferDateStr = task.deferDate ? ` [DEFER: ${new Date(task.deferDate).toLocaleDateString()}]` : '';
              const statusStr = task.taskStatus !== 'Available' ? ` (${task.taskStatus})` : '';
              const estimateStr = task.estimatedMinutes ? ` ⏱${task.estimatedMinutes}m` : '';
              
              output += `• ${flagSymbol}${task.name}${dueDateStr}${deferDateStr}${statusStr}${estimateStr} [ID: ${task.id}]\n`;
              
              if (task.note && task.note.trim()) {
                output += `  📝 ${task.note.trim()}\n`;
              }
              
              // Show all tags for this task
              if (task.tags && task.tags.length > 0) {
                const tagNames = task.tags.map((tag: any) => {
                  // Highlight the matched tag
                  return data.matchedTags && data.matchedTags.includes(tag.name) 
                    ? `**${tag.name}**` 
                    : tag.name;
                }).join(', ');
                output += `  🏷 ${tagNames}\n`;
              }
              
              output += '\n';
            });
          });
          
          // Summary
          output += `📊 **Summary**: ${taskCount} task${taskCount === 1 ? '' : 's'} with tag ${searchTagsDisplay}${modeDisplay}\n`;
        }
      } else {
        output += "No tasks data available\n";
      }
      
      return output;
    }
    
    return "Unexpected result format from OmniFocus";
    
  } catch (error) {
    console.error("Error in getTasksByTag:", error);
    throw new Error(`Failed to get tasks by tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}