import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('getInboxTasks');

export interface GetInboxTasksOptions {
  hideCompleted?: boolean;
}

export async function getInboxTasks(options: GetInboxTasksOptions = {}): Promise<string> {
  const { hideCompleted = true } = options;
  
  try {
    // Execute the inbox script
    const result = await executeOmniFocusScript('@inboxTasks.js', { 
      hideCompleted: hideCompleted 
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
      
      // Format the inbox tasks
      let output = `# INBOX TASKS\n\n`;
      
      if (data.tasks && Array.isArray(data.tasks)) {
        if (data.tasks.length === 0) {
          output += "📪 Inbox is empty - well done!\n";
        } else {
          output += `📥 Found ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} in inbox:\n\n`;
          
          data.tasks.forEach((task: any, index: number) => {
            const flagSymbol = task.flagged ? '🚩 ' : '';
            const dueDateStr = task.dueDate ? ` [DUE: ${new Date(task.dueDate).toLocaleDateString()}]` : '';
            const statusStr = task.taskStatus !== 'Available' ? ` (${task.taskStatus})` : '';
            const createdStr = task.createdDate ? ` (created: ${new Date(task.createdDate).toLocaleDateString()})` : '';

            output += `${index + 1}. ${flagSymbol}${task.name}${dueDateStr}${statusStr} [ID: ${task.id}]${createdStr}\n`;
            
            if (task.note && task.note.trim()) {
              output += `   📝 ${task.note.trim()}\n`;
            }
          });
        }
      } else {
        output += "No inbox data available\n";
      }
      
      return output;
    }
    
    log.error('Unexpected result format', { resultType: typeof result, result });
    throw new Error('Unexpected result format from OmniFocus');

  } catch (error) {
    log.error('Error in getInboxTasks', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to get inbox tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}