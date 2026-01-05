// OmniJS script to find a task by ID or name
// This avoids AppleScript escaping issues with special characters like $
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const taskId = args.taskId || null;
    const taskName = args.taskName || null;

    if (!taskId && !taskName) {
      return JSON.stringify({
        success: false,
        error: "Either taskId or taskName must be provided"
      });
    }

    // Get all flattened tasks
    const allTasks = flattenedTasks;
    let foundTask = null;

    // Search by ID first (most reliable)
    if (taskId) {
      for (const task of allTasks) {
        if (task.id.primaryKey === taskId) {
          foundTask = task;
          break;
        }
      }
    }

    // If not found by ID, search by name (exact match)
    if (!foundTask && taskName) {
      for (const task of allTasks) {
        if (task.name === taskName) {
          foundTask = task;
          break;
        }
      }
    }

    if (!foundTask) {
      return JSON.stringify({
        success: false,
        error: "Task not found"
      });
    }

    // Build task info
    const taskInfo = {
      id: foundTask.id.primaryKey,
      name: foundTask.name,
      note: foundTask.note || "",
      completed: foundTask.taskStatus === Task.Status.Completed,
      dropped: foundTask.taskStatus === Task.Status.Dropped,
      flagged: foundTask.flagged,
      dueDate: foundTask.dueDate ? foundTask.dueDate.toISOString() : null,
      deferDate: foundTask.deferDate ? foundTask.deferDate.toISOString() : null,
      estimatedMinutes: foundTask.estimatedMinutes || null,
      hasChildren: foundTask.hasChildren,
      childrenCount: foundTask.children ? foundTask.children.length : 0,
      parentId: null,
      parentName: null,
      projectId: null,
      projectName: null,
      tags: [],
      repetitionRule: foundTask.repetitionRule ? foundTask.repetitionRule.toString() : null,
      isRepeating: foundTask.repetitionRule !== null
    };

    // Get parent info
    try {
      if (foundTask.parent && foundTask.parent.task) {
        taskInfo.parentId = foundTask.parent.id.primaryKey;
        taskInfo.parentName = foundTask.parent.name;
      }
    } catch (e) {
      // Parent not accessible
    }

    // Get project info
    try {
      if (foundTask.containingProject) {
        taskInfo.projectId = foundTask.containingProject.id.primaryKey;
        taskInfo.projectName = foundTask.containingProject.name;
      }
    } catch (e) {
      // Project not accessible
    }

    // Get tags
    try {
      if (foundTask.tags && foundTask.tags.length > 0) {
        taskInfo.tags = foundTask.tags.map(tag => ({
          id: tag.id.primaryKey,
          name: tag.name
        }));
      }
    } catch (e) {
      // Tags not accessible
    }

    return JSON.stringify({
      success: true,
      task: taskInfo
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error finding task: ${error}`
    });
  }
})();
