// Note: parseLocalDate is provided by sharedUtils.js
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const sourceProjectId = args.sourceProjectId || null;
    const sourceProjectName = args.sourceProjectName || null;
    const newName = args.newName;
    const folderName = args.folderName || null;
    const folderId = args.folderId || null;
    const resetDates = args.resetDates !== false;
    const shiftDates = args.shiftDates || null;
    const clearCompleted = args.clearCompleted !== false;
    const copyNotes = args.copyNotes !== false;
    const copyTags = args.copyTags !== false;

    // Find source project
    let sourceProject = null;
    if (sourceProjectId) {
      sourceProject = flattenedProjects.find(p => p.id.primaryKey === sourceProjectId);
    }
    if (!sourceProject && sourceProjectName) {
      const nameLower = sourceProjectName.toLowerCase();
      sourceProject = flattenedProjects.find(p => p.name.toLowerCase() === nameLower);
    }

    if (!sourceProject) {
      return JSON.stringify({
        success: false,
        error: 'Source project not found: ' + (sourceProjectId || sourceProjectName)
      });
    }

    // Find or validate target folder
    let targetFolder = null;
    if (folderId) {
      targetFolder = flattenedFolders.find(f => f.id.primaryKey === folderId);
      if (!targetFolder) {
        return JSON.stringify({
          success: false,
          error: 'Target folder not found: ' + folderId
        });
      }
    }
    if (!targetFolder && folderName) {
      const nameLower = folderName.toLowerCase();
      targetFolder = flattenedFolders.find(f => f.name.toLowerCase() === nameLower);
      if (!targetFolder) {
        // Create new folder
        targetFolder = new Folder(folderName);
      }
    }

    // Calculate date shift if specified
    let dateShiftMs = 0;
    if (shiftDates && shiftDates.referenceDate) {
      const newStartDate = parseLocalDate(shiftDates.referenceDate);
      const basedOn = shiftDates.basedOn || 'defer';

      // Find earliest date in source project
      let earliestDate = null;
      const sourceTasks = sourceProject.flattenedTasks;
      for (let i = 0; i < sourceTasks.length; i++) {
        const task = sourceTasks[i];
        const dateToCheck = basedOn === 'defer' ? task.deferDate : task.dueDate;
        if (dateToCheck && (!earliestDate || dateToCheck < earliestDate)) {
          earliestDate = dateToCheck;
        }
      }

      if (earliestDate) {
        dateShiftMs = newStartDate.getTime() - earliestDate.getTime();
      }
    }

    // Create new project
    let newProject;
    if (targetFolder) {
      newProject = new Project(newName, targetFolder);
    } else {
      newProject = new Project(newName);
    }

    // Copy project properties
    if (copyNotes && sourceProject.note) {
      newProject.note = sourceProject.note;
    }
    newProject.sequential = sourceProject.sequential;

    // Get source tasks for hierarchy building
    const sourceTasks = sourceProject.flattenedTasks.slice();
    const sourceRootTaskId = sourceProject.rootTask ? sourceProject.rootTask.id.primaryKey : null;

    // Build task tree for recursive copy
    function getTaskTree(tasks, parentId) {
      const result = [];
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const taskParentId = task.parent ? task.parent.id.primaryKey : null;
        if (taskParentId === parentId) {
          result.push({
            task: task,
            children: getTaskTree(tasks, task.id.primaryKey)
          });
        }
      }
      return result;
    }

    const taskTree = getTaskTree(sourceTasks, sourceRootTaskId);

    // Recursive function to copy tasks
    function copyTasks(nodes, container) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const sourceTask = node.task;

        // Create new task
        const newTask = new Task(sourceTask.name, container);

        // Copy properties
        if (copyNotes && sourceTask.note) {
          newTask.note = sourceTask.note;
        }

        newTask.flagged = sourceTask.flagged;
        if (sourceTask.estimatedMinutes !== null) {
          newTask.estimatedMinutes = sourceTask.estimatedMinutes;
        }

        // Handle dates
        if (!resetDates) {
          if (shiftDates && dateShiftMs !== 0) {
            // Shift dates
            if (sourceTask.deferDate) {
              newTask.deferDate = new Date(sourceTask.deferDate.getTime() + dateShiftMs);
            }
            if (sourceTask.dueDate) {
              newTask.dueDate = new Date(sourceTask.dueDate.getTime() + dateShiftMs);
            }
          } else {
            // Copy dates as-is
            if (sourceTask.deferDate) {
              newTask.deferDate = sourceTask.deferDate;
            }
            if (sourceTask.dueDate) {
              newTask.dueDate = sourceTask.dueDate;
            }
          }
        }
        // If resetDates is true, leave dates null (default)

        // Copy tags
        if (copyTags) {
          const sourceTags = sourceTask.tags;
          for (let j = 0; j < sourceTags.length; j++) {
            newTask.addTag(sourceTags[j]);
          }
        }

        // Handle completion status
        if (!clearCompleted && sourceTask.taskStatus === Task.Status.Completed) {
          newTask.markComplete();
        }

        // Recursively copy children
        if (node.children.length > 0) {
          copyTasks(node.children, newTask);
        }
      }
    }

    copyTasks(taskTree, newProject);

    return JSON.stringify({
      success: true,
      newProjectId: newProject.id.primaryKey,
      newProjectName: newProject.name,
      tasksCopied: sourceTasks.length,
      sourceProject: sourceProject.name
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
})()
