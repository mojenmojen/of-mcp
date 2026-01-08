// OmniJS script to add multiple items in a single execution
// This provides true batching - all adds happen in one OmniFocus session
// Note: parseLocalDate and buildRRule are provided by sharedUtils.js
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
    let projectsByName = null;
    let projectsById = null;
    let tasksByName = null;
    let tasksById = null;
    let tagsByName = null;
    let foldersByName = null;
    let foldersById = null;

    function getProjectsByName() {
      if (!projectsByName) {
        projectsByName = new Map();
        flattenedProjects.forEach(p => projectsByName.set(p.name.toLowerCase(), p));
      }
      return projectsByName;
    }

    function getProjectsById() {
      if (!projectsById) {
        projectsById = new Map();
        flattenedProjects.forEach(p => projectsById.set(p.id.primaryKey, p));
      }
      return projectsById;
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

    function getTagsByName() {
      if (!tagsByName) {
        tagsByName = new Map();
        flattenedTags.forEach(t => tagsByName.set(t.name.toLowerCase(), t));
      }
      return tagsByName;
    }

    function getFoldersByName() {
      if (!foldersByName) {
        foldersByName = new Map();
        flattenedFolders.forEach(f => foldersByName.set(f.name.toLowerCase(), f));
      }
      return foldersByName;
    }

    function getFoldersById() {
      if (!foldersById) {
        foldersById = new Map();
        flattenedFolders.forEach(f => foldersById.set(f.id.primaryKey, f));
      }
      return foldersById;
    }

    const results = [];

    // Process each item
    for (const item of items) {
      try {
        const itemType = item.type || 'task';
        const itemName = item.name;

        if (!itemName) {
          results.push({
            success: false,
            error: "Item name is required"
          });
          continue;
        }

        if (itemType === 'task') {
          // Add task
          const taskNote = item.note || null;
          const dueDate = item.dueDate || null;
          const deferDate = item.deferDate || null;
          const plannedDate = item.plannedDate || null;
          const flagged = item.flagged || false;
          const estimatedMinutes = item.estimatedMinutes || null;
          const tagNames = item.tags || [];
          const projectName = item.projectName || null;
          const projectId = item.projectId || null;
          const parentTaskId = item.parentTaskId || null;
          const parentTaskName = item.parentTaskName || null;
          const repetitionRule = item.repetitionRule || null;

          // Determine container (only load collections if needed)
          let container = null;
          let containerType = 'inbox';

          if (parentTaskId) {
            container = Task.byIdentifier(parentTaskId);
            if (container) {
              containerType = 'parentTask';
            } else {
              results.push({
                success: false,
                name: itemName,
                error: `Parent task not found with ID: ${parentTaskId}`
              });
              continue;
            }
          } else if (parentTaskName) {
            container = getTasksByName().get(parentTaskName.toLowerCase());
            if (container) {
              containerType = 'parentTask';
            } else {
              results.push({
                success: false,
                name: itemName,
                error: `Parent task not found: ${parentTaskName}`
              });
              continue;
            }
          } else if (projectId || projectName) {
            // Try ID first, then name
            if (projectId) {
              container = getProjectsById().get(projectId);
            }
            if (!container && projectName) {
              container = getProjectsByName().get(projectName.toLowerCase());
            }
            if (container) {
              containerType = 'project';
            } else {
              const searchRef = projectId ? `ID "${projectId}"` : `name "${projectName}"`;
              results.push({
                success: false,
                name: itemName,
                error: `Project not found with ${searchRef}`
              });
              continue;
            }
          }

          // Create the task
          let newTask;
          if (containerType === 'inbox') {
            newTask = new Task(itemName, inbox.ending);
          } else if (containerType === 'parentTask') {
            newTask = new Task(itemName, inbox.ending);
            moveTasks([newTask], container);
          } else if (containerType === 'project') {
            newTask = new Task(itemName, container.ending);
          }

          // Set properties
          if (taskNote) newTask.note = taskNote;
          if (dueDate) newTask.dueDate = parseLocalDate(dueDate);
          if (deferDate) newTask.deferDate = parseLocalDate(deferDate);
          if (plannedDate) newTask.plannedDate = parseLocalDate(plannedDate);
          if (flagged) newTask.flagged = true;
          if (estimatedMinutes) newTask.estimatedMinutes = estimatedMinutes;

          // Add tags (only load tags collection if needed)
          if (tagNames && tagNames.length > 0) {
            const tags = getTagsByName();
            for (const tagName of tagNames) {
              const tag = tags.get(tagName.toLowerCase());
              if (tag) newTask.addTag(tag);
            }
          }

          // Set repetition rule
          let repetitionWarning = null;
          if (repetitionRule && repetitionRule.frequency) {
            try {
              const rruleString = buildRRule(repetitionRule);
              const repeatFromCompletion = repetitionRule.repeatFrom === 'completion';
              if (repeatFromCompletion) {
                newTask.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DeferUntilDate);
              } else {
                newTask.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DueDate);
              }
            } catch (repError) {
              // Task created, just not repeating - capture warning for user
              repetitionWarning = `Could not set repetition rule: ${repError}`;
            }
          }

          const taskResult = {
            success: true,
            type: 'task',
            id: newTask.id.primaryKey,
            name: newTask.name
          };
          if (repetitionWarning) {
            taskResult.warning = repetitionWarning;
          }
          results.push(taskResult);

        } else if (itemType === 'project') {
          // Add project
          const projectNote = item.note || null;
          const dueDate = item.dueDate || null;
          const deferDate = item.deferDate || null;
          const flagged = item.flagged || false;
          const estimatedMinutes = item.estimatedMinutes || null;
          const tagNames = item.tags || [];
          const folderName = item.folderName || null;
          const folderId = item.folderId || null;
          const sequential = item.sequential || false;

          // Determine container folder (only load if needed) - ID takes priority
          let container = null;
          if (folderId || folderName) {
            if (folderId) {
              container = getFoldersById().get(folderId);
            }
            if (!container && folderName) {
              container = getFoldersByName().get(folderName.toLowerCase());
            }
            if (!container) {
              const searchRef = folderId ? `ID "${folderId}"` : `name "${folderName}"`;
              results.push({
                success: false,
                name: itemName,
                error: `Folder not found with ${searchRef}`
              });
              continue;
            }
          }

          // Create the project
          let newProject;
          if (container) {
            newProject = new Project(itemName, container);
          } else {
            newProject = new Project(itemName);
          }

          // Set properties
          if (projectNote) newProject.note = projectNote;
          if (dueDate) newProject.dueDate = parseLocalDate(dueDate);
          if (deferDate) newProject.deferDate = parseLocalDate(deferDate);
          if (flagged) newProject.flagged = true;
          if (estimatedMinutes) newProject.estimatedMinutes = estimatedMinutes;
          newProject.sequential = sequential;

          // Add tags (only load tags collection if needed)
          if (tagNames && tagNames.length > 0) {
            const tags = getTagsByName();
            for (const tagName of tagNames) {
              const tag = tags.get(tagName.toLowerCase());
              if (tag) newProject.addTag(tag);
            }
          }

          results.push({
            success: true,
            type: 'project',
            id: newProject.id.primaryKey,
            name: newProject.name
          });

        } else {
          results.push({
            success: false,
            name: itemName,
            error: `Invalid item type: ${itemType}`
          });
        }

      } catch (itemError) {
        results.push({
          success: false,
          error: `Error processing item: ${itemError}`
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
      error: `Error in batch add: ${error}`
    });
  }
})();
