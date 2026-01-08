import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export interface ListTagsOptions {
  includeDropped?: boolean;
  showTaskCounts?: boolean;
}

interface TagInfo {
  id: string;
  name: string;
  active: boolean;
  status: 'active' | 'onHold' | 'dropped';
  taskCount?: number;
  availableTaskCount?: number;
  parent: string | null;
}

interface ListTagsResult {
  success: boolean;
  count: number;
  tags: TagInfo[];
  error?: string;
}

export async function listTags(options: ListTagsOptions = {}): Promise<string> {
  const { includeDropped = false, showTaskCounts = false } = options;

  try {
    const result = await executeOmniFocusScript('@listTags.js', {
      includeDropped,
      showTaskCounts
    });

    let parsed: ListTagsResult;
    if (typeof result === 'string') {
      parsed = JSON.parse(result);
    } else {
      parsed = result as ListTagsResult;
    }

    if (!parsed.success) {
      throw new Error(parsed.error || 'Unknown error');
    }

    // Format output
    let output = `# 🏷️ ALL TAGS\n\n`;
    output += `Found ${parsed.count} tag${parsed.count === 1 ? '' : 's'}${includeDropped ? ' (including dropped)' : ''}:\n\n`;

    if (parsed.tags.length === 0) {
      output += 'No tags found.\n';
      return output;
    }

    // Group by parent for hierarchical display
    const topLevel: TagInfo[] = [];
    const byParent = new Map<string, TagInfo[]>();

    for (const tag of parsed.tags) {
      if (tag.parent) {
        if (!byParent.has(tag.parent)) {
          byParent.set(tag.parent, []);
        }
        byParent.get(tag.parent)!.push(tag);
      } else {
        topLevel.push(tag);
      }
    }

    // Display tags
    const getStatusDisplay = (status: string) => {
      switch (status) {
        case 'onHold': return ' ⏸️ (on hold)';
        case 'dropped': return ' 🚫 (dropped)';
        default: return '';
      }
    };

    for (const tag of topLevel) {
      const status = getStatusDisplay(tag.status);
      const tasks = (showTaskCounts && tag.availableTaskCount && tag.availableTaskCount > 0)
        ? ` [${tag.availableTaskCount} available]`
        : '';
      output += `• **${tag.name}**${status}${tasks} [ID: ${tag.id}]\n`;

      // Show children if any
      const children = byParent.get(tag.name);
      if (children) {
        for (const child of children) {
          const childStatus = getStatusDisplay(child.status);
          const childTasks = (showTaskCounts && child.availableTaskCount && child.availableTaskCount > 0)
            ? ` [${child.availableTaskCount} available]`
            : '';
          output += `  └─ ${child.name}${childStatus}${childTasks} [ID: ${child.id}]\n`;
        }
      }
    }

    output += `\n📊 **Summary**: ${parsed.count} tags\n`;

    return output;

  } catch (error) {
    console.error("Error in listTags:", error);
    throw new Error(`Failed to list tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
