// Batch filter tasks across multiple projects in a single call
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const projectIds = args.projectIds || [];
    const projectNames = args.projectNames || [];
    const taskStatus = args.taskStatus || null;
    const flagged = args.flagged !== undefined ? args.flagged : null;
    const dueToday = args.dueToday || false;
    const dueThisWeek = args.dueThisWeek || false;
    const overdue = args.overdue || false;
    const limit = args.limit || 100;
    const sortBy = args.sortBy || "name";
    const sortOrder = args.sortOrder || "asc";

    // formatDate and taskStatusMap are provided by sharedUtils.js

    function getTaskStatus(status) {
      return taskStatusMap[status] || "Unknown";
    }

    function isToday(date) {
      if (!date) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const checkDate = new Date(date);
      return checkDate >= today && checkDate < tomorrow;
    }

    function isThisWeek(date) {
      if (!date) return false;
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const checkDate = new Date(date);
      return checkDate >= startOfWeek && checkDate < endOfWeek;
    }

    function isOverdue(date) {
      if (!date) return false;
      const now = new Date();
      return new Date(date) < now;
    }

    // Build project lookup maps (only actual projects, not action groups)
    const projectsById = new Map();
    const projectsByNameLower = new Map();
    flattenedProjects.forEach(p => {
      // Skip action groups - they have IDs with dots like "abc123.14"
      // Real project IDs don't have dots
      if (p.id.primaryKey.includes('.')) {
        return;
      }
      projectsById.set(p.id.primaryKey, p);
      // Store by lowercase name for case-insensitive matching
      const nameLower = p.name.toLowerCase();
      if (!projectsByNameLower.has(nameLower)) {
        projectsByNameLower.set(nameLower, []);
      }
      projectsByNameLower.get(nameLower).push(p);
    });

    // Resolve projects to filter
    const projectsToFilter = [];
    const notFound = [];

    // Add projects by ID
    for (const id of projectIds) {
      const project = projectsById.get(id);
      if (project) {
        projectsToFilter.push(project);
      } else {
        notFound.push(`ID: ${id}`);
      }
    }

    // Add projects by name (partial match)
    for (const name of projectNames) {
      const nameLower = name.toLowerCase();
      let found = false;

      // Try exact match first
      if (projectsByNameLower.has(nameLower)) {
        projectsByNameLower.get(nameLower).forEach(p => {
          if (!projectsToFilter.some(existing => existing.id.primaryKey === p.id.primaryKey)) {
            projectsToFilter.push(p);
            found = true;
          }
        });
      }

      // Try partial match
      if (!found) {
        for (const [key, projects] of projectsByNameLower) {
          if (key.includes(nameLower)) {
            projects.forEach(p => {
              if (!projectsToFilter.some(existing => existing.id.primaryKey === p.id.primaryKey)) {
                projectsToFilter.push(p);
                found = true;
              }
            });
          }
        }
      }

      if (!found) {
        notFound.push(`Name: "${name}"`);
      }
    }

    // Process each project
    const projectResults = [];

    for (const project of projectsToFilter) {
      // Get tasks for this project
      let tasks = [];
      try {
        // Get all tasks in project (including from nested action groups)
        const projectTasks = project.flattenedTasks || [];

        // Filter tasks
        tasks = projectTasks.filter(task => {
          try {
            const status = getTaskStatus(task.taskStatus);

            // Exclude completed/dropped unless explicitly requested
            if (status === "Completed" || status === "Dropped") {
              if (!taskStatus || !taskStatus.includes(status)) {
                return false;
              }
            }

            // Status filter
            if (taskStatus && taskStatus.length > 0) {
              if (!taskStatus.includes(status)) {
                return false;
              }
            }

            // Flagged filter
            if (flagged !== null && task.flagged !== flagged) {
              return false;
            }

            // Due date filters
            if (dueToday && !isToday(task.dueDate)) {
              return false;
            }
            if (dueThisWeek && !isThisWeek(task.dueDate)) {
              return false;
            }
            if (overdue && !isOverdue(task.dueDate)) {
              return false;
            }

            return true;
          } catch (e) {
            return false;
          }
        });
      } catch (e) {
        // Skip project if error accessing tasks
      }

      // Sort tasks
      if (sortBy === "dueDate") {
        tasks.sort((a, b) => {
          const dateA = a.dueDate || new Date('2099-12-31');
          const dateB = b.dueDate || new Date('2099-12-31');
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });
      } else if (sortBy === "deferDate") {
        tasks.sort((a, b) => {
          const dateA = a.deferDate || new Date('2099-12-31');
          const dateB = b.deferDate || new Date('2099-12-31');
          return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
        });
      } else if (sortBy === "flagged") {
        tasks.sort((a, b) => {
          if (a.flagged === b.flagged) return 0;
          if (sortOrder === "desc") {
            return a.flagged ? -1 : 1;
          }
          return a.flagged ? 1 : -1;
        });
      } else {
        // Default: sort by name
        tasks.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          if (nameA < nameB) return sortOrder === "desc" ? 1 : -1;
          if (nameA > nameB) return sortOrder === "desc" ? -1 : 1;
          return 0;
        });
      }

      const totalCount = tasks.length;

      // Apply limit
      if (limit && tasks.length > limit) {
        tasks = tasks.slice(0, limit);
      }

      // Format task data
      const taskData = tasks.map(task => {
        try {
          return {
            id: task.id.primaryKey,
            name: task.name,
            note: task.note || "",
            taskStatus: getTaskStatus(task.taskStatus),
            flagged: task.flagged,
            dueDate: formatDate(task.dueDate),
            deferDate: formatDate(task.deferDate),
            estimatedMinutes: task.estimatedMinutes,
            tags: task.tags.map(tag => ({
              id: tag.id.primaryKey,
              name: tag.name
            }))
          };
        } catch (e) {
          return null;
        }
      }).filter(t => t !== null);

      projectResults.push({
        projectId: project.id.primaryKey,
        projectName: project.name,
        taskCount: taskData.length,
        totalCount: totalCount,
        tasks: taskData
      });
    }

    return JSON.stringify({
      success: true,
      projectResults: projectResults,
      notFound: notFound,
      totalProjects: projectResults.length,
      totalTasks: projectResults.reduce((sum, p) => sum + p.taskCount, 0)
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error in batch filter: ${error}`
    });
  }
})();
