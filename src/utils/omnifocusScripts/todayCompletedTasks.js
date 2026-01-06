// Simplified script to get today's completed tasks
(() => {
  try {
    // Get parameters (if any)
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const limit = args.limit || 20;

    console.log("=== Today's completed tasks query started ===");

    // Get all tasks
    const allTasks = flattenedTasks;
    console.log(`Total tasks: ${allTasks.length}`);

    // Filter completed tasks
    const completedTasks = allTasks.filter(task =>
      task.taskStatus === Task.Status.Completed
    );
    console.log(`Completed tasks: ${completedTasks.length}`);

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    console.log(`Today's range: ${today.toISOString()} to ${tomorrow.toISOString()}`);

    // Filter tasks completed today
    const todayCompletedTasks = completedTasks.filter(task => {
      if (!task.completionDate) return false;

      const completedDate = new Date(task.completionDate);
      return completedDate >= today && completedDate < tomorrow;
    });

    console.log(`Tasks completed today: ${todayCompletedTasks.length}`);

    // Task status mapping
    const statusMap = {
      [Task.Status.Available]: "Available",
      [Task.Status.Blocked]: "Blocked",
      [Task.Status.Completed]: "Completed",
      [Task.Status.Dropped]: "Dropped",
      [Task.Status.DueSoon]: "DueSoon",
      [Task.Status.Next]: "Next",
      [Task.Status.Overdue]: "Overdue"
    };

    // Build export data
    const exportData = {
      exportDate: new Date().toISOString(),
      tasks: [],
      totalCount: completedTasks.length,
      filteredCount: todayCompletedTasks.length,
      query: "Tasks completed today"
    };

    // Process each task completed today
    const tasksToProcess = todayCompletedTasks.slice(0, limit);

    tasksToProcess.forEach(task => {
      try {
        const taskData = {
          id: task.id.primaryKey,
          name: task.name,
          note: task.note || "",
          taskStatus: statusMap[task.taskStatus] || "Unknown",
          flagged: task.flagged,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
          deferDate: task.deferDate ? task.deferDate.toISOString() : null,
          completedDate: task.completionDate ? task.completionDate.toISOString() : null,
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
        console.log(`Error processing task: ${taskError}`);
      }
    });

    console.log(`Successfully processed ${exportData.tasks.length} tasks completed today`);
    console.log("=== Today's completed tasks query finished ===");

    return JSON.stringify(exportData);

  } catch (error) {
    console.error(`Today's completed tasks query error: ${error}`);
    return JSON.stringify({
      success: false,
      error: `Today's completed tasks query error: ${error}`
    });
  }
})();
