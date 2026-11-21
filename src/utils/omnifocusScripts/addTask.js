// OmniJS script to add a task
// This avoids AppleScript issues with ISO date parsing and special characters
// Note: parseLocalDate, buildRRule, buildRepetitionRule, resolveProjectRef and formatAmbiguousProjectError are provided by sharedUtils.js
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const taskName = args.name || null;
    const taskNote = args.note || null;
    const dueDate = args.dueDate || null;
    const deferDate = args.deferDate || null;
    const plannedDate = args.plannedDate || null;
    const flagged = args.flagged || false;
    const estimatedMinutes = args.estimatedMinutes || null;
    const tagNames = args.tags || [];
    const projectName = args.projectName || null;
    const projectId = args.projectId || null;
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
    } else if (projectId || projectName) {
      // Find project by ID first (if provided), then by name
      const allProjects = flattenedProjects;

      // Try ID lookup first
      if (projectId) {
        for (const proj of allProjects) {
          if (proj.id.primaryKey === projectId) {
            container = proj;
            containerType = 'project';
            break;
          }
        }
      }

      // Fall back to name lookup if ID not found or not provided. A name
      // shared by several projects resolves to the single live one, or
      // fails closed (#149).
      if (!container && projectName) {
        const ref = resolveProjectRef(projectName, allProjects);
        if (ref.ambiguous) {
          return JSON.stringify({
            success: false,
            error: formatAmbiguousProjectError(projectName, ref.matches, 'projectId')
          });
        }
        if (ref.project) {
          container = ref.project;
          containerType = 'project';
        }
      }

      if (!container) {
        const searchRef = projectId ? `ID "${projectId}"` : `name "${projectName}"`;
        return JSON.stringify({
          success: false,
          error: `Project not found with ${searchRef}`
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

    // Set due date - parseLocalDate handles date-only strings correctly
    if (dueDate) {
      newTask.dueDate = parseLocalDate(dueDate);
    }

    // Set defer date
    if (deferDate) {
      newTask.deferDate = parseLocalDate(deferDate);
    }

    // Set planned date
    if (plannedDate) {
      newTask.plannedDate = parseLocalDate(plannedDate);
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
    let repetitionWarning = null;
    if (repetitionRule && repetitionRule.frequency) {
      try {
        const rruleString = buildRRule(repetitionRule);
        newTask.repetitionRule = buildRepetitionRule(rruleString, repetitionRule.repeatFrom);
      } catch (repError) {
        // If repetition rule fails, task is still created, just not repeating
        // Capture warning to return to user instead of silently logging
        repetitionWarning = `Could not set repetition rule: ${repError}`;
        console.log(`Warning: ${repetitionWarning}`);
      }
    }

    // Report where the task landed, read back from the created task only, so
    // the reply names where OmniFocus put it rather than what was asked for
    // (#157). The read has its own guard because the task already exists: a
    // throw reaching the outer catch would report success:false, and a caller
    // told the add failed retries it and duplicates the task (#154). On a
    // throw, location stays undefined and the reply describes what was asked.
    let location;
    try {
      const parent = newTask.parent;
      if (parent && !parent.project) {
        // A real parent task. A task at a project's top level has the
        // project's root task as its parent, and that one has .project set.
        location = { type: 'parentTask', name: parent.name, id: parent.id.primaryKey };
      } else {
        const project = newTask.containingProject;
        location = project
          ? { type: 'project', name: project.name, id: project.id.primaryKey }
          : { type: 'inbox' };
      }
    } catch (locationError) {
      console.log(`Warning: could not read the new task's location: ${locationError}`);
    }

    const result = {
      success: true,
      taskId: newTask.id.primaryKey,
      name: newTask.name,
      isRepeating: newTask.repetitionRule !== null,
      location: location
    };
    if (repetitionWarning) {
      result.warning = repetitionWarning;
    }
    return JSON.stringify(result);

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error adding task: ${error}`
    });
  }
})();
