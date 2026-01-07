// Fixed version of filter_tasks
(() => {
  try {
    // Get parameters
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const filters = {
      taskStatus: args.taskStatus || null,
      perspective: args.perspective || "all",
      flagged: args.flagged !== undefined ? args.flagged : null,
      inInbox: args.inInbox !== undefined ? args.inInbox : null,

      // Completion date filters
      completedToday: args.completedToday || false,
      completedYesterday: args.completedYesterday || false,
      completedThisWeek: args.completedThisWeek || false,
      completedThisMonth: args.completedThisMonth || false,
      completedBefore: args.completedBefore || null,
      completedAfter: args.completedAfter || null,

      // Planned date filters
      plannedToday: args.plannedToday || false,
      plannedThisWeek: args.plannedThisWeek || false,
      plannedBefore: args.plannedBefore || null,
      plannedAfter: args.plannedAfter || null,

      // Other filters
      projectFilter: args.projectFilter || null,
      projectId: args.projectId || null,
      tagFilter: args.tagFilter || null,
      tagId: args.tagId || null,
      exactTagMatch: args.exactTagMatch || false,
      searchText: args.searchText || null,
      limit: args.limit || 100,
      sortBy: args.sortBy || "name",
      sortOrder: args.sortOrder || "asc"
    };

    // Normalize tag filters to arrays
    const tagNames = filters.tagFilter
      ? (Array.isArray(filters.tagFilter) ? filters.tagFilter : [filters.tagFilter])
      : [];
    const tagIds = filters.tagId
      ? (Array.isArray(filters.tagId) ? filters.tagId : [filters.tagId])
      : [];

    // Build tag ID lookup map if needed
    let tagsById = null;
    if (tagIds.length > 0) {
      tagsById = new Map();
      flattenedTags.forEach(t => tagsById.set(t.id.primaryKey, t));
    }

    // Build project ID lookup map if needed
    let projectsById = null;
    if (filters.projectId) {
      projectsById = new Map();
      flattenedProjects.forEach(p => projectsById.set(p.id.primaryKey, p));
    }

    // Helper functions
    function getTaskStatus(status) {
      const taskStatusMap = {
        [Task.Status.Available]: "Available",
        [Task.Status.Blocked]: "Blocked",
        [Task.Status.Completed]: "Completed",
        [Task.Status.Dropped]: "Dropped",
        [Task.Status.DueSoon]: "DueSoon",
        [Task.Status.Next]: "Next",
        [Task.Status.Overdue]: "Overdue"
      };
      return taskStatusMap[status] || "Unknown";
    }

    function formatDate(date) {
      if (!date) return null;
      return date.toISOString();
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

    function isYesterday(date) {
      if (!date) return false;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date(yesterday);
      today.setDate(yesterday.getDate() + 1);
      const checkDate = new Date(date);
      return checkDate >= yesterday && checkDate < today;
    }

    function isThisWeek(date) {
      if (!date) return false;
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      const checkDate = new Date(date);
      return checkDate >= startOfWeek && checkDate < endOfWeek;
    }

    // Get all tasks
    const allTasks = flattenedTasks;

    // Determine if we need to include completed tasks
    const wantsCompletedTasks = filters.completedToday || filters.completedYesterday ||
                               filters.completedThisWeek || filters.completedThisMonth ||
                               filters.completedBefore || filters.completedAfter;
    const includeCompletedByStatus = filters.taskStatus &&
      (filters.taskStatus.includes("Completed") || filters.taskStatus.includes("Dropped"));

    // Select task set
    let availableTasks;
    if (wantsCompletedTasks || includeCompletedByStatus) {
      availableTasks = allTasks;
    } else {
      availableTasks = allTasks.filter(task =>
        task.taskStatus !== Task.Status.Completed &&
        task.taskStatus !== Task.Status.Dropped
      );
    }

    // Apply perspective filter
    let baseTasks = [];
    switch (filters.perspective) {
      case "inbox":
        baseTasks = availableTasks.filter(task => task.inInbox);
        break;
      case "flagged":
        baseTasks = availableTasks.filter(task => task.flagged);
        break;
      default:
        baseTasks = availableTasks;
        break;
    }

    // Apply all filters
    let filteredTasks = baseTasks.filter(task => {
      try {
        const taskStatus = getTaskStatus(task.taskStatus);

        // Completed tasks logic
        if (wantsCompletedTasks) {
          // Only want completed tasks
          if (taskStatus !== "Completed") {
            return false;
          }
        } else {
          // Exclude completed tasks (unless status explicitly specified)
          if (!includeCompletedByStatus && (taskStatus === "Completed" || taskStatus === "Dropped")) {
            return false;
          }
        }

        // Status filter
        if (filters.taskStatus && filters.taskStatus.length > 0) {
          if (!filters.taskStatus.includes(taskStatus)) {
            return false;
          }
        }

        // Flagged filter
        if (filters.flagged !== null && task.flagged !== filters.flagged) {
          return false;
        }

        // Inbox filter
        if (filters.inInbox !== null && task.inInbox !== filters.inInbox) {
          return false;
        }

        // Project filter - ID takes priority over name
        if (filters.projectId) {
          const taskProjectId = task.containingProject ? task.containingProject.id.primaryKey : null;
          if (taskProjectId !== filters.projectId) {
            return false;
          }
        } else if (filters.projectFilter) {
          const projectName = task.containingProject ? task.containingProject.name : '';
          if (!projectName.toLowerCase().includes(filters.projectFilter.toLowerCase())) {
            return false;
          }
        }

        // Tag filter - ID takes priority over name
        if (tagIds.length > 0) {
          // Filter by tag ID
          const taskTagIds = task.tags.map(t => t.id.primaryKey);
          const hasMatchingTag = tagIds.some(id => taskTagIds.includes(id));
          if (!hasMatchingTag) {
            return false;
          }
        } else if (tagNames.length > 0) {
          // Filter by tag name
          const taskTagNames = task.tags.map(t => t.name.toLowerCase());
          const hasMatchingTag = tagNames.some(name => {
            const nameLower = name.toLowerCase();
            if (filters.exactTagMatch) {
              return taskTagNames.includes(nameLower);
            } else {
              return taskTagNames.some(tagName => tagName.includes(nameLower));
            }
          });
          if (!hasMatchingTag) {
            return false;
          }
        }

        // Search text filter
        if (filters.searchText) {
          const searchLower = filters.searchText.toLowerCase();
          const taskName = (task.name || '').toLowerCase();
          const taskNote = (task.note || '').toLowerCase();
          if (!taskName.includes(searchLower) && !taskNote.includes(searchLower)) {
            return false;
          }
        }

        // Completion date filter
        if (wantsCompletedTasks) {
          if (filters.completedToday && !isToday(task.completionDate)) {
            return false;
          }
          if (filters.completedYesterday && !isYesterday(task.completionDate)) {
            return false;
          }
          if (filters.completedBefore && task.completionDate &&
              new Date(task.completionDate) >= new Date(filters.completedBefore)) {
            return false;
          }
          if (filters.completedAfter && task.completionDate &&
              new Date(task.completionDate) <= new Date(filters.completedAfter)) {
            return false;
          }
        }

        // Planned date filter
        if (filters.plannedToday) {
          if (!isToday(task.plannedDate)) {
            return false;
          }
        }
        if (filters.plannedThisWeek) {
          if (!isThisWeek(task.plannedDate)) {
            return false;
          }
        }
        if (filters.plannedBefore && task.plannedDate &&
            new Date(task.plannedDate) >= new Date(filters.plannedBefore)) {
          return false;
        }
        if (filters.plannedAfter && task.plannedDate &&
            new Date(task.plannedDate) <= new Date(filters.plannedAfter)) {
          return false;
        }

        return true;
      } catch (error) {
        return false;
      }
    });

    // Sort
    if (filters.sortBy === "completedDate") {
      filteredTasks.sort((a, b) => {
        const dateA = a.completionDate || new Date('1900-01-01');
        const dateB = b.completionDate || new Date('1900-01-01');
        return filters.sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    } else if (filters.sortBy === "plannedDate") {
      filteredTasks.sort((a, b) => {
        const dateA = a.plannedDate || new Date('1900-01-01');
        const dateB = b.plannedDate || new Date('1900-01-01');
        return filters.sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    } else if (filters.sortBy === "dueDate") {
      filteredTasks.sort((a, b) => {
        const dateA = a.dueDate || new Date('1900-01-01');
        const dateB = b.dueDate || new Date('1900-01-01');
        return filters.sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    } else if (filters.sortBy === "deferDate") {
      filteredTasks.sort((a, b) => {
        const dateA = a.deferDate || new Date('1900-01-01');
        const dateB = b.deferDate || new Date('1900-01-01');
        return filters.sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    } else {
      filteredTasks.sort((a, b) => {
        const valueA = a.name || '';
        const valueB = b.name || '';
        if (valueA < valueB) return filters.sortOrder === "desc" ? 1 : -1;
        if (valueA > valueB) return filters.sortOrder === "desc" ? -1 : 1;
        return 0;
      });
    }

    // Capture count after filtering but before limit
    const totalMatchingCount = filteredTasks.length;

    // Limit results
    if (filters.limit && filteredTasks.length > filters.limit) {
      filteredTasks = filteredTasks.slice(0, filters.limit);
    }

    // Build return data
    const exportData = {
      exportDate: new Date().toISOString(),
      tasks: [],
      totalCount: totalMatchingCount,
      filteredCount: filteredTasks.length,
      sortedBy: filters.sortBy,
      sortOrder: filters.sortOrder
    };

    // Process each task
    filteredTasks.forEach(task => {
      try {
        const taskData = {
          id: task.id.primaryKey,
          name: task.name,
          note: task.note || "",
          taskStatus: getTaskStatus(task.taskStatus),
          flagged: task.flagged,
          dueDate: formatDate(task.dueDate),
          deferDate: formatDate(task.deferDate),
          plannedDate: formatDate(task.plannedDate),
          completedDate: formatDate(task.completionDate),
          estimatedMinutes: task.estimatedMinutes,
          projectId: task.containingProject ? task.containingProject.id.primaryKey : null,
          projectName: task.containingProject ? task.containingProject.name : null,
          inInbox: task.inInbox,
          tags: task.tags.map(tag => ({
            id: tag.id.primaryKey,
            name: tag.name
          })),
          repetitionRule: task.repetitionRule ? task.repetitionRule.toString() : null,
          isRepeating: task.repetitionRule !== null
        };

        exportData.tasks.push(taskData);
      } catch (taskError) {
        // Skip tasks with processing errors
      }
    });

    return JSON.stringify(exportData);

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error filtering tasks: ${error}`
    });
  }
})();
