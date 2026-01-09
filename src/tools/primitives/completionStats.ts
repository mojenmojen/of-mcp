import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('completionStats');

export interface CompletionStatsOptions {
  completedAfter?: string;
  completedBefore?: string;
  groupBy?: "project" | "tag" | "folder";
  minCount?: number;
}

export async function getCompletionStats(options: CompletionStatsOptions = {}): Promise<string> {
  try {
    const {
      groupBy = "project",
      minCount = 0
    } = options;

    const scriptParams = {
      ...options,
      groupBy,
      minCount
    };

    // Check cache first
    const { data: cached, checksum } = await queryCache.getWithChecksum<unknown>('completionStats', scriptParams);
    let result: unknown;

    if (cached) {
      log.debug('Using cached result');
      result = cached;
    } else {
      result = await executeOmniFocusScript('@completionStats.js', scriptParams);
      await queryCache.set('completionStats', scriptParams, result, checksum);
    }

    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        return result as string;
      }
    }

    if (result && typeof result === 'object') {
      const data = result as any;

      if (data.error) {
        throw new Error(data.error);
      }

      // Format output
      let output = `# 📈 COMPLETION STATS\n\n`;

      // Period
      if (data.period?.start || data.period?.end) {
        output += `**Period**: `;
        if (data.period.start && data.period.end) {
          output += `${data.period.start} to ${data.period.end}\n`;
        } else if (data.period.start) {
          output += `After ${data.period.start}\n`;
        } else if (data.period.end) {
          output += `Before ${data.period.end}\n`;
        }
      }

      output += `**Grouped by**: ${data.groupBy}\n`;
      output += `**Total completed**: ${data.totalCompleted} tasks\n\n`;

      if (data.byGroup && data.byGroup.length > 0) {
        // Format as table
        const groupLabel = data.groupBy.charAt(0).toUpperCase() + data.groupBy.slice(1);
        output += `| ${groupLabel} | Count | % |\n`;
        output += `|---|---:|---:|\n`;

        data.byGroup.forEach((group: any) => {
          output += `| ${group.name} | ${group.count} | ${group.percentage}% |\n`;
        });
      } else {
        output += `No completions found for the specified period.\n`;
      }

      return output;
    }

    return "Unexpected result format from OmniFocus";

  } catch (error) {
    log.error('Error in getCompletionStats', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to get completion stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
