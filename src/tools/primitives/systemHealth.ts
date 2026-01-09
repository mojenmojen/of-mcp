import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('systemHealth');

export interface SystemHealthResult {
  inbox: number;
  projects: {
    active: number;
    onHold: number;
    completed: number;
    dropped: number;
  };
  tasks: {
    available: number;
    next: number;
    blocked: number;
    dueSoon: number;
    overdue: number;
    completed: number;
    dropped: number;
  };
  tags: {
    active: number;
    onHold: number;
    dropped: number;
  };
  flagged: number;
  untagged: number;
  calculated: {
    activeTasks: number;
    overduePercent: number;
  };
}

export async function getSystemHealth(): Promise<string> {
  try {
    // Check cache first
    const { data: cached, checksum } = await queryCache.getWithChecksum<unknown>('systemHealth', {});
    let result: unknown;

    if (cached) {
      log.debug('Using cached result');
      result = cached;
    } else {
      result = await executeOmniFocusScript('@systemHealth.js', {});
      await queryCache.set('systemHealth', {}, result, checksum);
    }

    if (typeof result === 'string') {
      const rawString = result;
      try {
        result = JSON.parse(rawString);
      } catch (parseError) {
        log.warn('Failed to parse OmniFocus response as JSON', {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          rawOutputPreview: rawString.substring(0, 200)
        });
        // Check if it looks like an error message from OmniFocus
        if (rawString.toLowerCase().includes('error')) {
          throw new Error(`OmniFocus returned an error: ${rawString.substring(0, 500)}`);
        }
        throw new Error(`Failed to parse OmniFocus response: ${rawString.substring(0, 200)}`);
      }
    }

    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Format output
      let output = `# 📊 SYSTEM HEALTH\n\n`;

      // Inbox
      const inboxStatus = data.inbox <= 20 ? '🟢' : data.inbox <= 50 ? '🟡' : '🔴';
      output += `## Inbox\n`;
      output += `${inboxStatus} **${data.inbox}** tasks in inbox\n\n`;

      // Projects
      output += `## Projects\n`;
      const projectsActive = data.projects?.active || 0;
      const projectStatus = (projectsActive >= 45 && projectsActive <= 55) ? '🟢' :
                           (projectsActive >= 40 && projectsActive <= 70) ? '🟡' : '🔴';
      output += `${projectStatus} **${projectsActive}** active`;
      if (data.projects?.onHold) output += ` | ${data.projects.onHold} on hold`;
      if (data.projects?.dropped) output += ` | ${data.projects.dropped} dropped`;
      if (data.projects?.completed) output += ` | ${data.projects.completed} completed`;
      output += `\n\n`;

      // Tasks
      output += `## Tasks\n`;
      const tasksNext = data.tasks?.next || 0;
      const nextStatus = (tasksNext >= 35 && tasksNext <= 40) ? '🟢' :
                        (tasksNext >= 30 && tasksNext <= 45) ? '🟡' : '🔴';
      output += `${nextStatus} **${tasksNext}** next actions`;
      output += ` | ${data.tasks?.available || 0} available`;
      output += ` | ${data.tasks?.blocked || 0} blocked\n`;

      // Overdue
      const overduePercent = data.calculated?.overduePercent || 0;
      const overdueStatus = overduePercent <= 3 ? '🟢' : overduePercent <= 5 ? '🟡' : '🔴';
      output += `${overdueStatus} **${data.tasks?.overdue || 0}** overdue (${overduePercent}%)`;
      if (data.tasks?.dueSoon) output += ` | ${data.tasks.dueSoon} due soon`;
      output += `\n\n`;

      // Flagged & Untagged
      output += `## Focus\n`;
      output += `🚩 **${data.flagged || 0}** flagged tasks\n`;
      const untaggedStatus = (data.untagged || 0) <= 5 ? '🟢' :
                            (data.untagged || 0) <= 15 ? '🟡' : '🔴';
      output += `${untaggedStatus} **${data.untagged || 0}** untagged tasks\n\n`;

      // Tags
      output += `## Tags\n`;
      output += `${data.tags?.active || 0} active`;
      if (data.tags?.onHold) output += ` | ${data.tags.onHold} on hold`;
      if (data.tags?.dropped) output += ` | ${data.tags.dropped} dropped`;
      output += `\n`;

      return output;
    }

    log.error('Unexpected result format from OmniFocus', {
      resultType: typeof result,
      resultValue: result === null ? 'null' : result === undefined ? 'undefined' : JSON.stringify(result).substring(0, 200)
    });
    throw new Error(`Unexpected result format from OmniFocus (got ${typeof result}). Please check OmniFocus is running and accessible.`);

  } catch (error) {
    log.error('Error in getSystemHealth', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to get system health: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
