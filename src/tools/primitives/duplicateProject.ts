import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('duplicateProject');

export interface DuplicateProjectOptions {
  sourceProjectId?: string;
  sourceProjectName?: string;
  newName: string;
  folderName?: string;
  folderId?: string;
  resetDates?: boolean;
  shiftDates?: {
    referenceDate: string;
    basedOn?: "defer" | "due";
  };
  clearCompleted?: boolean;
  copyNotes?: boolean;
  copyTags?: boolean;
}

interface DuplicateResult {
  success: boolean;
  error?: string;
  newProjectId: string;
  newProjectName: string;
  tasksCopied: number;
  sourceProject: string;
}

export async function duplicateProject(options: DuplicateProjectOptions): Promise<string> {
  try {
    const {
      resetDates = true,
      clearCompleted = true,
      copyNotes = true,
      copyTags = true
    } = options;

    const scriptParams = {
      ...options,
      resetDates: options.shiftDates ? false : resetDates, // shiftDates overrides resetDates
      clearCompleted,
      copyNotes,
      copyTags
    };

    const result = await executeOmniFocusScript('@duplicateProject.js', scriptParams);

    // Invalidate cache since we created new items
    queryCache.invalidate();

    let parsed: DuplicateResult;
    if (typeof result === 'string') {
      parsed = JSON.parse(result);
    } else {
      parsed = result as DuplicateResult;
    }

    if (!parsed.success) {
      throw new Error(parsed.error || 'Unknown error');
    }

    // Format success message
    let output = `✅ Project duplicated successfully!\n\n`;
    output += `**Source**: ${parsed.sourceProject}\n`;
    output += `**New Project**: ${parsed.newProjectName}\n`;
    output += `**Project ID**: ${parsed.newProjectId}\n`;
    output += `**Tasks Copied**: ${parsed.tasksCopied}\n`;

    if (options.shiftDates) {
      output += `\n📅 Dates shifted relative to ${options.shiftDates.referenceDate} (based on ${options.shiftDates.basedOn || 'defer'} dates)\n`;
    } else if (resetDates) {
      output += `\n📅 All dates cleared (tasks are undated)\n`;
    }

    if (clearCompleted) {
      output += `✨ All tasks reset to incomplete\n`;
    }

    return output;

  } catch (error) {
    log.error('Error in duplicateProject', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to duplicate project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
