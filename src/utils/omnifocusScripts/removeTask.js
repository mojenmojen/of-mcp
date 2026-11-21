// OmniJS script to remove a task or project
// This avoids AppleScript escaping issues with special characters like $
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const taskId = args.id || null;
    const taskName = args.name || null;
    const itemType = args.itemType || 'task';

    if (!taskId && !taskName) {
      return JSON.stringify({
        success: false,
        error: "Either id or name must be provided"
      });
    }

    // Get all items based on type
    let allItems;
    if (itemType === 'project') {
      allItems = flattenedProjects;
    } else {
      allItems = flattenedTasks;
    }

    // Find the item
    let foundItem = null;

    // Search by ID first
    if (taskId) {
      for (const item of allItems) {
        if (item.id.primaryKey === taskId) {
          foundItem = item;
          break;
        }
      }
    }

    // If not found by ID, search by name. A project name compares
    // case-insensitively, and a name shared by several projects resolves to
    // the single live one, or fails closed (#149). A task name still takes
    // the first exact-case match.
    let sharedNameMatches = 0;
    if (!foundItem && taskName) {
      if (itemType === 'project') {
        const ref = resolveProjectRef(taskName, allItems);
        if (ref.ambiguous) {
          return JSON.stringify({
            success: false,
            error: formatAmbiguousProjectError(taskName, ref.matches, 'id')
          });
        }
        foundItem = ref.project;
        if (foundItem && ref.matches.length > 1) {
          sharedNameMatches = ref.matches.length;
        }
      } else {
        for (const item of allItems) {
          if (item.name === taskName) {
            foundItem = item;
            break;
          }
        }
      }
    }

    if (!foundItem) {
      return JSON.stringify({
        success: false,
        error: "Item not found"
      });
    }

    // Store info before deletion
    const removal = {
      success: true,
      id: foundItem.id.primaryKey,
      name: foundItem.name
    };
    // A removal can't be undone, so when the name was shared the reply says
    // which project went and how many of that name are left (#149).
    if (sharedNameMatches > 1) {
      removal.status = projectStatusWord(foundItem);
      removal.otherMatches = sharedNameMatches - 1;
    }

    // Delete the item
    deleteObject(foundItem);

    return JSON.stringify(removal);

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error removing item: ${error}`
    });
  }
})();
