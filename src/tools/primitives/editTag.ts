import { executeOmniFocusScript } from '../../utils/scriptExecution.js';
import { queryCache } from '../../utils/cache.js';
import { logger } from '../../utils/logger.js';

const log = logger.child('editTag');

export interface EditTagOptions {
  tagId?: string;
  tagName?: string;
  newName?: string;
  newStatus?: 'active' | 'onHold' | 'dropped';
  newParentTagId?: string;
  newParentTagName?: string;
  allowsNextAction?: boolean;
}

interface EditTagResult {
  success: boolean;
  error?: string;
  tagId: string;
  tagName: string;
  originalName: string;
  changes: {
    name?: string;
    status?: string;
    parent?: string | null;
    allowsNextAction?: boolean;
  };
}

export async function editTag(options: EditTagOptions): Promise<string> {
  try {
    const result = await executeOmniFocusScript('@editTag.js', options);

    // Invalidate cache since we modified a tag
    queryCache.invalidate();

    let parsed: EditTagResult;
    if (typeof result === 'string') {
      parsed = JSON.parse(result);
    } else {
      parsed = result as EditTagResult;
    }

    if (!parsed.success) {
      throw new Error(parsed.error || 'Unknown error');
    }

    // Format success message
    const changes: string[] = [];
    if (parsed.changes.name) {
      changes.push(`name → "${parsed.changes.name}"`);
    }
    if (parsed.changes.status) {
      changes.push(`status → ${parsed.changes.status}`);
    }
    if (parsed.changes.parent !== undefined) {
      changes.push(`parent → ${parsed.changes.parent || '(top-level)'}`);
    }
    if (parsed.changes.allowsNextAction !== undefined) {
      changes.push(`allowsNextAction → ${parsed.changes.allowsNextAction}`);
    }

    let output = `✅ Tag "${parsed.tagName}" updated:\n`;
    output += changes.map(c => `- ${c}`).join('\n');
    output += `\n\n[ID: ${parsed.tagId}]`;

    return output;

  } catch (error) {
    log.error('Error in editTag', { error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Failed to edit tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
