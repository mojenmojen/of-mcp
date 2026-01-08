// OmniJS script to get tasks by tag from OmniFocus
// Supports multiple tags with "any" (OR) or "all" (AND) matching
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    // Normalize tagName and tagId to arrays
    const rawTagName = args.tagName || null;
    const rawTagId = args.tagId || null;
    const tagNames = rawTagName ? (Array.isArray(rawTagName) ? rawTagName : [rawTagName]) : [];
    const tagIds = rawTagId ? (Array.isArray(rawTagId) ? rawTagId : [rawTagId]) : [];
    const hideCompleted = args.hideCompleted !== false; // Default to true
    const exactMatch = args.exactMatch || false;
    const matchMode = args.tagMatchMode || 'any'; // 'any' (OR) or 'all' (AND)
    const limit = (args.limit !== undefined && args.limit !== null) ? args.limit : 500; // Limit results to prevent timeout

    if (tagNames.length === 0 && tagIds.length === 0) {
      return JSON.stringify({
        success: false,
        error: "Tag name or tag ID is required"
      });
    }

    // formatDate and taskStatusMap are provided by sharedUtils.js

    function getTaskStatus(status) {
      return taskStatusMap[status] || "Unknown";
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      searchTags: tagNames.length > 0 ? tagNames : tagIds,
      searchMode: tagNames.length > 0 ? 'name' : 'id',
      matchMode: matchMode,
      exactMatch: exactMatch,
      matchedTagsBySearchTerm: {},
      tasks: [],
      availableTags: []
    };

    // Get all active tags for reference
    const allTags = flattenedTags.filter(tag => tag.active);
    exportData.availableTags = allTags.map(tag => tag.name).sort();

    // Build tag ID map for ID lookups
    const tagsById = new Map();
    allTags.forEach(tag => tagsById.set(tag.id.primaryKey, tag));

    console.log(`Searching for tags (${tagNames.length > 0 ? 'by name' : 'by ID'}): [${(tagNames.length > 0 ? tagNames : tagIds).join(', ')}] (exact: ${exactMatch}, mode: ${matchMode})`);

    // Find matching OmniFocus tags for each search term
    const matchingTagsBySearchTerm = new Map();

    if (tagIds.length > 0) {
      // Search by ID - exact match only
      tagIds.forEach(searchId => {
        const tag = tagsById.get(searchId);
        const matches = tag ? [tag] : [];
        matchingTagsBySearchTerm.set(searchId, matches);
        exportData.matchedTagsBySearchTerm[searchId] = matches.map(t => t.name);
        console.log(`Search ID "${searchId}" matched ${matches.length} tags: ${matches.map(t => t.name).join(', ')}`);
      });
    } else {
      // Search by name
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
    }

    // Check if any search term found no tags
    // Use Set for O(1) deduplication instead of O(n) find()
    const seenTagIds = new Set();
    const allMatchedTags = [];
    let hasEmptyMatch = false;
    matchingTagsBySearchTerm.forEach((tags, term) => {
      if (tags.length === 0) {
        hasEmptyMatch = true;
        console.log(`No tags found for search term "${term}"`);
      }
      tags.forEach(tag => {
        const tagId = tag.id.primaryKey;
        if (!seenTagIds.has(tagId)) {
          seenTagIds.add(tagId);
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
      // Use a Set for O(1) deduplication instead of O(n) find()
      const seenTaskIds = new Set();
      // Calculate collection limit - collect more than needed to account for completed filtering
      const collectionLimit = hideCompleted ? limit * 3 : limit * 2;
      let reachedCollectionLimit = false;

      for (const tag of allMatchedTags) {
        if (reachedCollectionLimit) break;

        const tasksWithTag = tag.tasks;
        console.log(`Tag "${tag.name}" has ${tasksWithTag.length} tasks`);

        for (const task of tasksWithTag) {
          const taskId = task.id.primaryKey;
          if (!seenTaskIds.has(taskId)) {
            seenTaskIds.add(taskId);
            matchingTasks.push(task);

            // Early exit once we have enough candidates
            if (matchingTasks.length >= collectionLimit) {
              console.log(`Reached collection limit of ${collectionLimit}, stopping early`);
              reachedCollectionLimit = true;
              break;
            }
          }
        }
      }
    } else {
      // AND logic: task must have tags matching ALL search terms
      // First get all tasks from all matched tags
      const allTasksFromTags = new Map();
      allMatchedTags.forEach(tag => {
        tag.tasks.forEach(task => {
          allTasksFromTags.set(task.id.primaryKey, task);
        });
      });

      // Pre-compute tag ID sets for each search term for faster lookup
      const searchTermTagIds = new Map();
      matchingTagsBySearchTerm.forEach((matchedTags, searchTerm) => {
        searchTermTagIds.set(searchTerm, new Set(matchedTags.map(t => t.id.primaryKey)));
      });

      // Calculate collection limit for early exit
      const collectionLimit = hideCompleted ? limit * 3 : limit * 2;

      // For each task, check if it has at least one tag from each search term group
      for (const [taskId, task] of allTasksFromTags) {
        const taskTagIds = new Set(task.tags.map(t => t.id.primaryKey));

        let matchesAllSearchTerms = true;
        for (const [searchTerm, tagIdSet] of searchTermTagIds) {
          // Task must have at least one of the tags from this search term's matches
          let hasMatchForTerm = false;
          for (const tagId of taskTagIds) {
            if (tagIdSet.has(tagId)) {
              hasMatchForTerm = true;
              break;
            }
          }
          if (!hasMatchForTerm) {
            matchesAllSearchTerms = false;
            break; // No need to check other search terms
          }
        }

        if (matchesAllSearchTerms) {
          matchingTasks.push(task);
          // Early exit once we have enough candidates
          if (matchingTasks.length >= collectionLimit) {
            console.log(`Reached collection limit of ${collectionLimit} for ALL mode, stopping early`);
            break;
          }
        }
      }
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