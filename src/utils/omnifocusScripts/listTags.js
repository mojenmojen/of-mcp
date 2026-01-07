// OmniJS script to list all tags from OmniFocus
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const includeDropped = args.includeDropped || false;
    const showTaskCounts = args.showTaskCounts || false;

    const tags = [];

    for (const tag of flattenedTags) {
      // Skip inactive (dropped) tags unless requested
      if (!includeDropped && !tag.active) {
        continue;
      }

      const tagData = {
        id: tag.id.primaryKey,
        name: tag.name,
        active: tag.active,
        parent: tag.parent ? tag.parent.name : null
      };

      // Only fetch task counts if requested (expensive operation)
      if (showTaskCounts) {
        tagData.taskCount = tag.tasks ? tag.tasks.length : 0;
        tagData.availableTaskCount = tag.availableTasks ? tag.availableTasks.length : 0;
      }

      tags.push(tagData);
    }

    // Sort alphabetically by name
    tags.sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({
      success: true,
      count: tags.length,
      tags: tags
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error listing tags: ${error}`
    });
  }
})();
