// OmniJS script to remove multiple items in a single execution
// This provides true batching - all removals happen in one OmniFocus session
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const items = args.items || [];

    if (!items || items.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No items provided"
      });
    }

    // Lazy-load lookup Maps only when needed
    let projectsById = null;
    let projectsByName = null;
    let tasksById = null;
    let tasksByName = null;

    function getProjectsById() {
      if (!projectsById) {
        projectsById = new Map();
        flattenedProjects.forEach(p => projectsById.set(p.id.primaryKey, p));
      }
      return projectsById;
    }

    function getProjectsByName() {
      if (!projectsByName) {
        projectsByName = new Map();
        flattenedProjects.forEach(p => projectsByName.set(p.name.toLowerCase(), p));
      }
      return projectsByName;
    }

    function getTasksById() {
      if (!tasksById) {
        tasksById = new Map();
        flattenedTasks.forEach(t => tasksById.set(t.id.primaryKey, t));
      }
      return tasksById;
    }

    function getTasksByName() {
      if (!tasksByName) {
        tasksByName = new Map();
        flattenedTasks.forEach(t => {
          if (!tasksByName.has(t.name.toLowerCase())) {
            tasksByName.set(t.name.toLowerCase(), t);
          }
        });
      }
      return tasksByName;
    }

    const results = [];

    // Process each item
    for (const item of items) {
      try {
        const itemId = item.id || null;
        const itemName = item.name || null;
        const itemType = item.itemType || 'task';

        if (!itemId && !itemName) {
          results.push({
            success: false,
            error: "Either id or name must be provided"
          });
          continue;
        }

        // Find the item - use fast byIdentifier for ID lookups
        let foundItem = null;

        if (itemType === 'project') {
          if (itemId) foundItem = Project.byIdentifier(itemId);
          if (!foundItem && itemName) foundItem = getProjectsByName().get(itemName.toLowerCase());
        } else {
          if (itemId) foundItem = Task.byIdentifier(itemId);
          if (!foundItem && itemName) foundItem = getTasksByName().get(itemName.toLowerCase());
        }

        if (!foundItem) {
          results.push({
            success: false,
            id: itemId,
            name: itemName,
            error: "Item not found"
          });
          continue;
        }

        // Store info before deletion - may fail if already scheduled for deletion
        let deletedId, deletedName;
        try {
          deletedId = foundItem.id.primaryKey;
          deletedName = foundItem.name;
        } catch (accessError) {
          // Item may already be scheduled for deletion (parent was deleted)
          const errorStr = String(accessError);
          if (errorStr.includes('scheduled for deletion')) {
            results.push({
              success: true,
              id: itemId || 'unknown',
              name: itemName || 'unknown',
              note: 'Already scheduled for deletion (parent deleted)'
            });
            continue;
          }
          throw accessError;
        }

        // Try to delete the item
        try {
          deleteObject(foundItem);
        } catch (deleteError) {
          // Check if already scheduled for deletion (e.g., parent was deleted)
          const errorStr = String(deleteError);
          if (errorStr.includes('scheduled for deletion')) {
            // Item is already being deleted - treat as success
            results.push({
              success: true,
              id: deletedId,
              name: deletedName,
              note: 'Already scheduled for deletion (parent deleted)'
            });
            continue;
          }
          throw deleteError; // Re-throw other errors
        }

        // Remove from maps so subsequent lookups don't find deleted items
        if (itemType === 'project') {
          if (projectsById) projectsById.delete(deletedId);
          if (projectsByName) projectsByName.delete(deletedName.toLowerCase());
        } else {
          if (tasksById) tasksById.delete(deletedId);
          if (tasksByName) tasksByName.delete(deletedName.toLowerCase());
        }

        results.push({
          success: true,
          id: deletedId,
          name: deletedName
        });

      } catch (itemError) {
        // Check if this is a "scheduled for deletion" error
        const errorStr = String(itemError);
        if (errorStr.includes('scheduled for deletion')) {
          results.push({
            success: true,
            id: item.id || item.name || 'unknown',
            name: item.name || 'unknown',
            note: 'Already scheduled for deletion (parent deleted)'
          });
          continue;
        }
        results.push({
          success: false,
          error: `Error removing item: ${itemError}`
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return JSON.stringify({
      success: successCount > 0,
      successCount: successCount,
      failureCount: failureCount,
      results: results
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error in batch remove: ${error}`
    });
  }
})();
