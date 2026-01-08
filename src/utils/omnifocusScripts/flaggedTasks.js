// OmniJS script to get flagged tasks from OmniFocus
(() => {
  try {
    // Get parameters from injectedArgs
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const hideCompleted = args.hideCompleted !== false; // Default to true
    const projectFilter = args.projectFilter || null;
    const projectId = args.projectId || null;

    // formatDate and taskStatusMap are provided by sharedUtils.js

    function getTaskStatus(status) {
      return taskStatusMap[status] || "Unknown";
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      tasks: []
    };

    // Get all flagged tasks using flattenedTasks with flagged filter
    let flaggedTasks = flattenedTasks.filter(task => task.flagged);
    console.log(`Found ${flaggedTasks.length} total flagged tasks`);

    // Filter by completion status if needed
    if (hideCompleted) {
      flaggedTasks = flaggedTasks.filter(task =>
        task.taskStatus !== Task.Status.Completed &&
        task.taskStatus !== Task.Status.Dropped
      );
    }

    // Filter by project - ID takes priority over name
    if (projectId) {
      flaggedTasks = flaggedTasks.filter(task => {
        const taskProjectId = task.containingProject ? task.containingProject.id.primaryKey : null;
        return taskProjectId === projectId;
      });
    } else if (projectFilter) {
      flaggedTasks = flaggedTasks.filter(task => {
        const projectName = task.containingProject ? task.containingProject.name : '';
        return projectName.toLowerCase().includes(projectFilter.toLowerCase());
      });
    }

    console.log(`Processing ${flaggedTasks.length} flagged tasks after filtering`);

    // Process each flagged task
    flaggedTasks.forEach(task => {
      try {
        const taskData = {
          id: task.id.primaryKey,
          name: task.name,
          note: task.note || "",
          taskStatus: getTaskStatus(task.taskStatus),
          flagged: task.flagged, // Should always be true for flagged tasks
          dueDate: formatDate(task.dueDate),
          deferDate: formatDate(task.deferDate),
          estimatedMinutes: task.estimatedMinutes,
          projectId: task.containingProject ? task.containingProject.id.primaryKey : null,
          projectName: task.containingProject ? task.containingProject.name : null,
          inInbox: task.inInbox,
          tags: task.tags.map(tag => ({
            id: tag.id.primaryKey,
            name: tag.name
          }))
        };

        exportData.tasks.push(taskData);
      } catch (taskError) {
        console.log(`Error processing flagged task: ${taskError}`);
      }
    });

    console.log(`Successfully processed ${exportData.tasks.length} flagged tasks`);
    return JSON.stringify(exportData);

  } catch (error) {
    console.error(`Error in flaggedTasks script: ${error}`);
    return JSON.stringify({
      success: false,
      error: `Error getting flagged tasks: ${error}`
    });
  }
})();
