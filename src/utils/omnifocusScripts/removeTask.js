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

    // If not found by ID, search by name
    if (!foundItem && taskName) {
      for (const item of allItems) {
        if (item.name === taskName) {
          foundItem = item;
          break;
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
    const deletedId = foundItem.id.primaryKey;
    const deletedName = foundItem.name;

    // Delete the item
    deleteObject(foundItem);

    return JSON.stringify({
      success: true,
      id: deletedId,
      name: deletedName
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error removing item: ${error}`
    });
  }
})();
