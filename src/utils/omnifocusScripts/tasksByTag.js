// OmniJS script to get tasks by tag from OmniFocus
// Supports multiple tags with "any" (OR) or "all" (AND) matching
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    // Normalize tagName to array
    const rawTagName = args.tagName || "work";
    const tagNames = Array.isArray(rawTagName) ? rawTagName : [rawTagName];
    const hideCompleted = args.hideCompleted !== false; // Default to true
    const exactMatch = args.exactMatch || false;
    const matchMode = args.tagMatchMode || 'any'; // 'any' (OR) or 'all' (AND)
    const limit = args.limit || 500; // Limit results to prevent timeout

    if (!tagNames || tagNames.length === 0) {
      return JSON.stringify({
        success: false,
        error: "Tag name is required"
      });
    }

    // Helper function to format dates consistently
    function formatDate(date) {
      if (!date) return null;
      return date.toISOString();
    }

    // Get task status enum mapping
    const taskStatusMap = {
      [Task.Status.Available]: "Available",
      [Task.Status.Blocked]: "Blocked",
      [Task.Status.Completed]: "Completed",
      [Task.Status.Dropped]: "Dropped",
      [Task.Status.DueSoon]: "DueSoon",
      [Task.Status.Next]: "Next",
      [Task.Status.Overdue]: "Overdue"
    };

    function getTaskStatus(status) {
      return taskStatusMap[status] || "Unknown";
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      searchTags: tagNames,
      matchMode: matchMode,
      exactMatch: exactMatch,
      matchedTagsBySearchTerm: {},
      tasks: [],
      availableTags: []
    };

    // Get all active tags for reference
    const allTags = flattenedTags.filter(tag => tag.active);
    exportData.availableTags = allTags.map(tag => tag.name).sort();

    console.log(`Searching for tags matching [${tagNames.join(', ')}] (exact: ${exactMatch}, mode: ${matchMode})`);

    // Find matching OmniFocus tags for each search term
    const matchingTagsBySearchTerm = new Map();
    tagNames.forEach(searchTerm => {
      let matches;
      if (exactMatch) {
        matches = allTags.filter(tag =>
          tag.name.toLowerCase() === searchTerm.toLowerCase()
        );
      } else {
        matches = allTags.filter(tag =>
          tag.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      matchingTagsBySearchTerm.set(searchTerm, matches);
      exportData.matchedTagsBySearchTerm[searchTerm] = matches.map(t => t.name);
      console.log(`Search term "${searchTerm}" matched ${matches.length} tags: ${matches.map(t => t.name).join(', ')}`);
    });

    // Check if any search term found no tags
    const allMatchedTags = [];
    let hasEmptyMatch = false;
    matchingTagsBySearchTerm.forEach((tags, term) => {
      if (tags.length === 0) {
        hasEmptyMatch = true;
        console.log(`No tags found for search term "${term}"`);
      }
      tags.forEach(tag => {
        if (!allMatchedTags.find(t => t.id.primaryKey === tag.id.primaryKey)) {
          allMatchedTags.push(tag);
        }
      });
    });

    // For "all" mode, if any search term has no matches, return empty
    if (matchMode === 'all' && hasEmptyMatch) {
      console.log('Match mode is "all" but some search terms have no matching tags - returning empty');
      return JSON.stringify(exportData);
    }

    if (allMatchedTags.length === 0) {
      console.log("No matching tags found for any search term");
      return JSON.stringify(exportData);
    }

    // Get tasks based on match mode
    let matchingTasks = [];

    if (matchMode === 'any') {
      // OR logic: task has at least one matching tag from any search term
      allMatchedTags.forEach(tag => {
        const tasksWithTag = tag.tasks;
        console.log(`Tag "${tag.name}" has ${tasksWithTag.length} tasks`);

        tasksWithTag.forEach(task => {
          if (!matchingTasks.find(t => t.id.primaryKey === task.id.primaryKey)) {
            matchingTasks.push(task);
          }
        });
      });
    } else {
      // AND logic: task must have tags matching ALL search terms
      // First get all tasks from all matched tags
      const allTasksFromTags = new Map();
      allMatchedTags.forEach(tag => {
        tag.tasks.forEach(task => {
          allTasksFromTags.set(task.id.primaryKey, task);
        });
      });

      // For each task, check if it has at least one tag from each search term group
      allTasksFromTags.forEach((task, taskId) => {
        const taskTagIds = new Set(task.tags.map(t => t.id.primaryKey));

        let matchesAllSearchTerms = true;
        matchingTagsBySearchTerm.forEach((matchedTags, searchTerm) => {
          // Task must have at least one of the tags from this search term's matches
          const hasMatchForTerm = matchedTags.some(tag => taskTagIds.has(tag.id.primaryKey));
          if (!hasMatchForTerm) {
            matchesAllSearchTerms = false;
          }
        });

        if (matchesAllSearchTerms) {
          matchingTasks.push(task);
        }
      });
    }

    console.log(`Found ${matchingTasks.length} unique tasks with matching tags (mode: ${matchMode})`);

    // Filter by completion status if needed
    if (hideCompleted) {
      matchingTasks = matchingTasks.filter(task =>
        task.taskStatus !== Task.Status.Completed &&
        task.taskStatus !== Task.Status.Dropped
      );
    }

    console.log(`Processing ${matchingTasks.length} tasks after filtering completed`);

    // Apply limit to prevent timeout
    let limitReached = false;
    let totalBeforeLimit = matchingTasks.length;
    if (matchingTasks.length > limit) {
      limitReached = true;
      matchingTasks = matchingTasks.slice(0, limit);
      console.log(`Limited to ${limit} tasks (was ${totalBeforeLimit})`);
    }
    exportData.limitReached = limitReached;
    exportData.totalBeforeLimit = totalBeforeLimit;

    // Process each matching task
    matchingTasks.forEach(task => {
      try {
        const taskData = {
          id: task.id.primaryKey,
          name: task.name,
          note: task.note || "",
          taskStatus: getTaskStatus(task.taskStatus),
          flagged: task.flagged,
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
        console.log(`Error processing task with tag: ${taskError}`);
      }
    });
    
    console.log(`Successfully processed ${exportData.tasks.length} tasks with matching tags`);
    return JSON.stringify(exportData);
    
  } catch (error) {
    console.error(`Error in tasksByTag script: ${error}`);
    return JSON.stringify({
      success: false,
      error: `Error getting tasks by tag: ${error}`
    });
  }
})();