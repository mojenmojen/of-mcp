// OmniJS script to get system health metrics in a single call
// Returns counts for inbox, projects, tasks, tags, flagged, and untagged
(() => {
  try {
    // taskStatusMap is provided by sharedUtils.js
    function getTaskStatus(status) {
      return taskStatusMap[status] || "Unknown";
    }

    // Count inbox tasks
    const inboxCount = inbox.tasks.length;

    // Count projects by status
    const projects = {
      active: 0,
      onHold: 0,
      completed: 0,
      dropped: 0
    };

    flattenedProjects.forEach(project => {
      switch (project.status) {
        case Project.Status.Active:
          projects.active++;
          break;
        case Project.Status.OnHold:
          projects.onHold++;
          break;
        case Project.Status.Done:
          projects.completed++;
          break;
        case Project.Status.Dropped:
          projects.dropped++;
          break;
      }
    });

    // Count tasks by status
    const tasks = {
      available: 0,
      next: 0,
      blocked: 0,
      dueSoon: 0,
      overdue: 0,
      completed: 0,
      dropped: 0
    };

    // Also count flagged and untagged
    let flaggedCount = 0;
    let untaggedCount = 0;

    // Track active (non-completed, non-dropped) tasks for percentage calculations
    let activeTasks = 0;

    flattenedTasks.forEach(task => {
      const status = getTaskStatus(task.taskStatus);

      switch (status) {
        case "Available":
          tasks.available++;
          activeTasks++;
          break;
        case "Next":
          tasks.next++;
          activeTasks++;
          break;
        case "Blocked":
          tasks.blocked++;
          activeTasks++;
          break;
        case "DueSoon":
          tasks.dueSoon++;
          activeTasks++;
          break;
        case "Overdue":
          tasks.overdue++;
          activeTasks++;
          break;
        case "Completed":
          tasks.completed++;
          break;
        case "Dropped":
          tasks.dropped++;
          break;
      }

      // Count flagged (only among active tasks)
      if (task.flagged && status !== "Completed" && status !== "Dropped") {
        flaggedCount++;
      }

      // Count untagged (only among active tasks)
      if (task.tags.length === 0 && status !== "Completed" && status !== "Dropped") {
        untaggedCount++;
      }
    });

    // Count tags by status
    const tags = {
      active: 0,
      onHold: 0,
      dropped: 0
    };

    flattenedTags.forEach(tag => {
      if (tag.active) {
        if (tag.status === Tag.Status.OnHold) {
          tags.onHold++;
        } else {
          tags.active++;
        }
      } else {
        tags.dropped++;
      }
    });

    // Calculate percentages
    const overduePercent = activeTasks > 0
      ? Math.round((tasks.overdue / activeTasks) * 1000) / 10  // One decimal place
      : 0;

    return JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      inbox: inboxCount,
      projects: projects,
      tasks: tasks,
      tags: tags,
      flagged: flaggedCount,
      untagged: untaggedCount,
      calculated: {
        activeTasks: activeTasks,
        overduePercent: overduePercent
      }
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error getting system health: ${error.name || 'Error'}: ${error.message || String(error)}`,
      errorType: error.name || 'Error',
      errorMessage: error.message || String(error)
    });
  }
})();
