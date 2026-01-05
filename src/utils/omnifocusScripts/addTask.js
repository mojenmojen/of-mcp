// OmniJS script to add a task
// This avoids AppleScript issues with ISO date parsing and special characters
(() => {
  // Helper function to build iCal RRULE string from repetition rule object
  function buildRRule(rule) {
    let rrule = `FREQ=${rule.frequency.toUpperCase()}`;
    if (rule.interval && rule.interval > 1) {
      rrule += `;INTERVAL=${rule.interval}`;
    }
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const days = rule.daysOfWeek.map(d => dayMap[d]).join(',');
      rrule += `;BYDAY=${days}`;
    }
    if (rule.dayOfMonth) {
      rrule += `;BYMONTHDAY=${rule.dayOfMonth}`;
    }
    if (rule.month) {
      rrule += `;BYMONTH=${rule.month}`;
    }
    return rrule;
  }

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
    const repetitionRule = args.repetitionRule || null;

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
      // Find parent task by name (case-insensitive)
      const allTasks = flattenedTasks;
      const parentTaskNameLower = parentTaskName.toLowerCase();
      for (const task of allTasks) {
        if (task.name.toLowerCase() === parentTaskNameLower) {
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
      // Find project by name (case-insensitive)
      const allProjects = flattenedProjects;
      const projectNameLower = projectName.toLowerCase();
      for (const proj of allProjects) {
        if (proj.name.toLowerCase() === projectNameLower) {
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
    let newTask;
    if (containerType === 'inbox') {
      newTask = new Task(taskName, inbox.ending);
    } else if (containerType === 'parentTask') {
      // For subtasks, create in inbox first then move to parent
      // Using moveTasks() is the reliable way to create subtasks
      newTask = new Task(taskName, inbox.ending);
      moveTasks([newTask], container);
    } else if (containerType === 'project') {
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

    // Add tags (case-insensitive matching)
    if (tagNames && tagNames.length > 0) {
      const allTags = flattenedTags;
      for (const tagName of tagNames) {
        const tagNameLower = tagName.toLowerCase();
        for (const tag of allTags) {
          if (tag.name.toLowerCase() === tagNameLower) {
            newTask.addTag(tag);
            break;
          }
        }
      }
    }

    // Set repetition rule if provided
    if (repetitionRule && repetitionRule.frequency) {
      try {
        const rruleString = buildRRule(repetitionRule);

        // Determine repetition method based on repeatFrom
        // 'due' = repeat from due date (Task.RepetitionMethod.DueDate)
        // 'completion' = repeat from completion (Task.RepetitionMethod.DeferUntilDate)
        const repeatFromCompletion = repetitionRule.repeatFrom === 'completion';

        // Create the repetition rule
        // OmniJS uses Task.RepetitionRule with method parameter
        if (repeatFromCompletion) {
          newTask.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DeferUntilDate);
        } else {
          newTask.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DueDate);
        }
      } catch (repError) {
        // If repetition rule fails, task is still created, just not repeating
        console.log(`Warning: Could not set repetition rule: ${repError}`);
      }
    }

    return JSON.stringify({
      success: true,
      taskId: newTask.id.primaryKey,
      name: newTask.name,
      isRepeating: newTask.repetitionRule !== null
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error adding task: ${error}`
    });
  }
})();
