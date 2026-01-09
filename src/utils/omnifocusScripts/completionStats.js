// OmniJS script to get completion statistics grouped by project, tag, or folder
// parseLocalDate is provided by sharedUtils.js
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    // Parse date parameters
    const completedAfter = args.completedAfter ? parseLocalDate(args.completedAfter) : null;
    const completedBefore = args.completedBefore ? parseLocalDate(args.completedBefore) : null;
    const groupBy = args.groupBy || "project"; // "project", "tag", or "folder"
    const minCount = args.minCount || 0;

    // Validate groupBy
    if (!["project", "tag", "folder"].includes(groupBy)) {
      return JSON.stringify({
        success: false,
        error: `Invalid groupBy value: ${groupBy}. Must be 'project', 'tag', or 'folder'.`
      });
    }

    // Get all completed tasks in the date range
    const completedTasks = [];

    flattenedTasks.forEach(task => {
      // Must be completed
      if (task.taskStatus !== Task.Status.Completed) {
        return;
      }

      const completionDate = task.completionDate;
      if (!completionDate) {
        return;
      }

      // Check date range
      if (completedAfter && completionDate < completedAfter) {
        return;
      }
      if (completedBefore && completionDate >= completedBefore) {
        return;
      }

      completedTasks.push(task);
    });

    // Group by the specified dimension
    const groupCounts = new Map();

    completedTasks.forEach(task => {
      let groupKeys = [];

      if (groupBy === "project") {
        if (task.containingProject) {
          groupKeys.push({
            id: task.containingProject.id.primaryKey,
            name: task.containingProject.name
          });
        } else if (task.inInbox) {
          groupKeys.push({
            id: "_inbox",
            name: "Inbox"
          });
        } else {
          groupKeys.push({
            id: "_no_project",
            name: "(No Project)"
          });
        }
      } else if (groupBy === "tag") {
        if (task.tags.length === 0) {
          groupKeys.push({
            id: "_untagged",
            name: "(Untagged)"
          });
        } else {
          // Count for each tag the task has
          task.tags.forEach(tag => {
            groupKeys.push({
              id: tag.id.primaryKey,
              name: tag.name
            });
          });
        }
      } else if (groupBy === "folder") {
        if (task.containingProject && task.containingProject.parentFolder) {
          groupKeys.push({
            id: task.containingProject.parentFolder.id.primaryKey,
            name: task.containingProject.parentFolder.name
          });
        } else if (task.inInbox) {
          groupKeys.push({
            id: "_inbox",
            name: "Inbox"
          });
        } else {
          groupKeys.push({
            id: "_no_folder",
            name: "(No Folder)"
          });
        }
      }

      // Increment counts
      groupKeys.forEach(key => {
        const existing = groupCounts.get(key.id);
        if (existing) {
          existing.count++;
        } else {
          groupCounts.set(key.id, {
            id: key.id,
            name: key.name,
            count: 1
          });
        }
      });
    });

    // Convert to array and sort by count descending
    let byGroup = Array.from(groupCounts.values());
    byGroup.sort((a, b) => b.count - a.count);

    // Filter by minCount
    if (minCount > 0) {
      byGroup = byGroup.filter(g => g.count >= minCount);
    }

    // Calculate percentages
    const totalCompleted = completedTasks.length;
    byGroup.forEach(group => {
      group.percentage = totalCompleted > 0
        ? Math.round((group.count / totalCompleted) * 1000) / 10
        : 0;
    });

    return JSON.stringify({
      success: true,
      period: {
        start: completedAfter ? completedAfter.toISOString().split('T')[0] : null,
        end: completedBefore ? completedBefore.toISOString().split('T')[0] : null
      },
      groupBy: groupBy,
      totalCompleted: totalCompleted,
      groupCount: byGroup.length,
      byGroup: byGroup
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error getting completion stats: ${error}`
    });
  }
})();
