# 011: Edit Tag Tool

## Priority: Medium
## Effort: Medium (2-3 hours)
## Category: New Tool

---

## Problem Statement

Tags in OmniFocus have three status states: Active, On Hold, and Dropped. Currently, the MCP server can:
- List tags (including dropped ones)
- Add/remove tags from tasks

But it **cannot**:
- Change a tag's status (activate, put on hold, drop)
- Create new tags directly (only implicitly via `addTags` on tasks)
- Rename tags
- Delete tags

This creates a gap where:
1. Tasks become mysteriously "Blocked" when their tag is On Hold or Dropped
2. Users cannot fix tag status issues without opening OmniFocus directly
3. Tag cleanup/reorganisation requires manual intervention

**Real-world example:** A user's tasks were all showing as "Blocked" because the `prep` tag was dropped (likely when its parent `office` tag was dropped). The MCP server could identify the problem but couldn't fix it.

---

## Proposed Solution

Add a new `edit_tag` tool that can:
1. Change tag status (active, onHold, dropped)
2. Rename tags
3. Move tags to different parent tags
4. Create new standalone tags

Also enhance `list_tags` to distinguish between On Hold and Dropped states.

---

## OmniFocus Tag Properties

Tags in OmniFocus have these relevant properties:
- `name` (string) - The tag name
- `status` (Tag.Status) - Active, OnHold, or Dropped
- `active` (boolean, read-only) - true if status is Active
- `parent` (Tag | null) - Parent tag for hierarchy
- `allowsNextAction` (boolean) - Whether tasks with this tag can be "next"

Tag.Status enum:
- `Tag.Status.Active`
- `Tag.Status.OnHold`
- `Tag.Status.Dropped`

---

## Files to Create

### `src/tools/definitions/editTag.ts`
```typescript
import { z } from "zod";
import { editTag } from "../primitives/editTag.js";

export const schema = z.object({
  tagId: z.string().optional().describe("ID of the tag to edit"),
  tagName: z.string().optional().describe("Name of the tag to edit (alternative to tagId)"),
  newName: z.string().optional().describe("New name for the tag"),
  newStatus: z.enum(["active", "onHold", "dropped"]).optional()
    .describe("New status: 'active', 'onHold', or 'dropped'"),
  newParentTagId: z.string().optional().describe("ID of new parent tag (use empty string to make top-level)"),
  newParentTagName: z.string().optional().describe("Name of new parent tag (alternative to ID)"),
  allowsNextAction: z.boolean().optional()
    .describe("Whether tasks with this tag can be 'next' actions")
});

export async function handler(args: z.infer<typeof schema>) {
  return await editTag(args);
}
```

### `src/tools/primitives/editTag.ts`
```typescript
import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export interface EditTagOptions {
  tagId?: string;
  tagName?: string;
  newName?: string;
  newStatus?: 'active' | 'onHold' | 'dropped';
  newParentTagId?: string;
  newParentTagName?: string;
  allowsNextAction?: boolean;
}

export async function editTag(options: EditTagOptions): Promise<string> {
  const { tagId, tagName, newName, newStatus, newParentTagId, newParentTagName, allowsNextAction } = options;

  if (!tagId && !tagName) {
    throw new Error('Either tagId or tagName is required');
  }

  const hasChanges = newName !== undefined ||
                     newStatus !== undefined ||
                     newParentTagId !== undefined ||
                     newParentTagName !== undefined ||
                     allowsNextAction !== undefined;

  if (!hasChanges) {
    throw new Error('At least one change parameter is required');
  }

  try {
    const result = await executeOmniFocusScript('@editTag.js', {
      tagId,
      tagName,
      newName,
      newStatus,
      newParentTagId,
      newParentTagName,
      allowsNextAction
    });

    let parsed;
    if (typeof result === 'string') {
      parsed = JSON.parse(result);
    } else {
      parsed = result;
    }

    if (!parsed.success) {
      throw new Error(parsed.error || 'Unknown error');
    }

    // Format success message
    const changes: string[] = [];
    if (parsed.changes.name) changes.push(`name → "${parsed.changes.name}"`);
    if (parsed.changes.status) changes.push(`status → ${parsed.changes.status}`);
    if (parsed.changes.parent !== undefined) {
      changes.push(`parent → ${parsed.changes.parent || '(top-level)'}`);
    }
    if (parsed.changes.allowsNextAction !== undefined) {
      changes.push(`allowsNextAction → ${parsed.changes.allowsNextAction}`);
    }

    return `✅ Tag "${parsed.tagName}" updated:\n- ${changes.join('\n- ')}`;

  } catch (error) {
    throw new Error(`Failed to edit tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### `src/utils/omnifocusScripts/editTag.js`
```javascript
// OmniJS script to edit a tag in OmniFocus
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const { tagId, tagName, newName, newStatus, newParentTagId, newParentTagName, allowsNextAction } = args;

    // Find the tag
    let tag = null;

    if (tagId) {
      tag = Tag.byIdentifier(tagId);
    }

    if (!tag && tagName) {
      // Search through all tags including dropped
      for (const t of flattenedTags) {
        if (t.name === tagName) {
          tag = t;
          break;
        }
      }
    }

    if (!tag) {
      return JSON.stringify({
        success: false,
        error: `Tag not found: ${tagId || tagName}`
      });
    }

    const changes = {};
    const originalName = tag.name;

    // Apply changes
    if (newName !== undefined && newName !== tag.name) {
      tag.name = newName;
      changes.name = newName;
    }

    if (newStatus !== undefined) {
      const statusMap = {
        'active': Tag.Status.Active,
        'onHold': Tag.Status.OnHold,
        'dropped': Tag.Status.Dropped
      };
      const targetStatus = statusMap[newStatus];
      if (targetStatus && tag.status !== targetStatus) {
        tag.status = targetStatus;
        changes.status = newStatus;
      }
    }

    if (newParentTagId !== undefined || newParentTagName !== undefined) {
      let newParent = null;

      if (newParentTagId === '' || newParentTagName === '') {
        // Move to top level - newParent stays null
      } else if (newParentTagId) {
        newParent = Tag.byIdentifier(newParentTagId);
      } else if (newParentTagName) {
        for (const t of flattenedTags) {
          if (t.name === newParentTagName) {
            newParent = t;
            break;
          }
        }
      }

      // Prevent circular reference
      if (newParent === tag) {
        return JSON.stringify({
          success: false,
          error: 'Cannot set tag as its own parent'
        });
      }

      // Check if newParent is a descendant of tag (would create cycle)
      let checkParent = newParent;
      while (checkParent) {
        if (checkParent === tag) {
          return JSON.stringify({
            success: false,
            error: 'Cannot move tag under its own descendant'
          });
        }
        checkParent = checkParent.parent;
      }

      // moveTo handles both setting parent and moving to top level
      if (newParent) {
        tag.moveTo(newParent.ending);
        changes.parent = newParent.name;
      } else {
        // Move to top level
        tag.moveTo(tags.ending);
        changes.parent = null;
      }
    }

    if (allowsNextAction !== undefined && tag.allowsNextAction !== allowsNextAction) {
      tag.allowsNextAction = allowsNextAction;
      changes.allowsNextAction = allowsNextAction;
    }

    return JSON.stringify({
      success: true,
      tagId: tag.id.primaryKey,
      tagName: tag.name,
      originalName: originalName,
      changes: changes
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error editing tag: ${error}`
    });
  }
})();
```

---

## Files to Modify

### `src/server.ts`
Add import and register the tool:
```typescript
import * as editTagTool from './tools/definitions/editTag.js';

server.tool(
  "edit_tag",
  "Edit a tag's properties: rename, change status (active/onHold/dropped), move to different parent, or set allowsNextAction. Use to reactivate dropped tags or reorganize tag hierarchy.",
  editTagTool.schema.shape,
  editTagTool.handler
);
```

### `src/tools/primitives/listTags.ts`
Update to show On Hold vs Dropped distinction:
```typescript
// Change the status display logic
const getStatusText = (tag: TagInfo) => {
  if (tag.status === 'onHold') return ' (on hold)';
  if (tag.status === 'dropped') return ' (dropped)';
  return '';
};
```

### `src/utils/omnifocusScripts/listTags.js`
Update to report actual status:
```javascript
const tagData = {
  id: tag.id.primaryKey,
  name: tag.name,
  active: tag.active,
  status: tag.status === Tag.Status.Active ? 'active'
        : tag.status === Tag.Status.OnHold ? 'onHold'
        : 'dropped',
  parent: tag.parent ? tag.parent.name : null
};
```

---

## Implementation Notes

- Tags with status OnHold block their tasks just like Dropped
- The `active` property is read-only (computed from status)
- When a parent tag is dropped, child tags remain but become orphaned in the hierarchy
- `flattenedTags` includes all tags regardless of status, unlike `tags` which excludes dropped
- Use `Tag.byIdentifier()` for ID lookup - it works for all statuses

---

## Acceptance Criteria

- [ ] `edit_tag` tool can change tag status to active/onHold/dropped
- [ ] `edit_tag` tool can rename tags
- [ ] `edit_tag` tool can move tags to different parents or top-level
- [ ] `edit_tag` tool validates against circular references
- [ ] `list_tags` distinguishes between On Hold and Dropped
- [ ] Error messages are clear when tag not found
- [ ] Tool is registered in server.ts
- [ ] Version bump in package.json

---

## Future Considerations

- `add_tag` tool for creating tags directly (without attaching to a task)
- `delete_tag` tool for permanent removal (vs dropping)
- `batch_edit_tags` for bulk operations
- `get_tag_by_id` for detailed tag information

---

## References

- OmniFocus Automation API: Tag class
- Existing `list_tags` implementation in src/tools/primitives/listTags.ts
- Real-world issue: Tasks blocked due to dropped "prep" tag (2026-01-08)
