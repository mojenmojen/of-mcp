// OmniJS script to add a task
// This avoids AppleScript issues with ISO date parsing and special characters
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const taskName = args.name || null;
    const taskNote = args.note || null;
    const dueDate = args.dueDate || null;
    const deferDate = args.deferDate || null;
    const flagged = args.flagged || false;
    const estimatedMinutes = args.estimatedMinutes || null;
    const tagNames = args.tags || [];
    const projectName = args.projectName || null;
    const parentTaskId = args.parentTaskId || null;
    const parentTaskName = args.parentTaskName || null;

    if (!taskName) {
      return JSON.stringify({
        success: false,
        error: "Task name is required"
      });
    }

    // Determine the container for the new task
    let container = null;
    let containerType = 'inbox';

    // Priority: parentTaskId > parentTaskName > projectName > inbox
    if (parentTaskId) {
      // Find parent task by ID
      const allTasks = flattenedTasks;
      for (const task of allTasks) {
        if (task.id.primaryKey === parentTaskId) {
          container = task;
          containerType = 'parentTask';
          break;
        }
      }
      if (!container) {
        return JSON.stringify({
          success: false,
          error: `Parent task not found with ID: ${parentTaskId}`
        });
      }
    } else if (parentTaskName) {
      // Find parent task by name
      const allTasks = flattenedTasks;
      for (const task of allTasks) {
        if (task.name === parentTaskName) {
          container = task;
          containerType = 'parentTask';
          break;
        }
      }
      if (!container) {
        return JSON.stringify({
          success: false,
          error: `Parent task not found: ${parentTaskName}`
        });
      }
    } else if (projectName) {
      // Find project by name
      const allProjects = flattenedProjects;
      for (const proj of allProjects) {
        if (proj.name === projectName) {
          container = proj;
          containerType = 'project';
          break;
        }
      }
      if (!container) {
        return JSON.stringify({
          success: false,
          error: `Project not found: ${projectName}`
        });
      }
    }

    // Create the new task
    // All container types need .ending to specify the insertion location
    let newTask;
    if (containerType === 'inbox') {
      newTask = new Task(taskName, inbox.ending);
    } else if (containerType === 'parentTask' || containerType === 'project') {
      newTask = new Task(taskName, container.ending);
    }

    // Set task properties
    if (taskNote) {
      newTask.note = taskNote;
    }

    // Set due date - JavaScript's Date() correctly parses ISO format
    if (dueDate) {
      newTask.dueDate = new Date(dueDate);
    }

    // Set defer date
    if (deferDate) {
      newTask.deferDate = new Date(deferDate);
    }

    // Set flagged
    if (flagged) {
      newTask.flagged = true;
    }

    // Set estimated minutes
    if (estimatedMinutes) {
      newTask.estimatedMinutes = estimatedMinutes;
    }

    // Add tags
    if (tagNames && tagNames.length > 0) {
      const allTags = flattenedTags;
      for (const tagName of tagNames) {
        for (const tag of allTags) {
          if (tag.name === tagName) {
            newTask.addTag(tag);
            break;
          }
        }
      }
    }

    return JSON.stringify({
      success: true,
      taskId: newTask.id.primaryKey,
      name: newTask.name
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error adding task: ${error}`
    });
  }
})();
