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
        error: 'Tag not found: ' + (tagId || tagName)
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
        if (!newParent) {
          return JSON.stringify({
            success: false,
            error: 'Parent tag not found: ' + newParentTagId
          });
        }
      } else if (newParentTagName) {
        for (const t of flattenedTags) {
          if (t.name === newParentTagName) {
            newParent = t;
            break;
          }
        }
        if (!newParent) {
          return JSON.stringify({
            success: false,
            error: 'Parent tag not found: ' + newParentTagName
          });
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
      error: 'Error editing tag: ' + error
    });
  }
})();
