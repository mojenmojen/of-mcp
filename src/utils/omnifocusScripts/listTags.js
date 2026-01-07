// OmniJS script to list all tags from OmniFocus
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const includeDropped = args.includeDropped || false;

    const tags = [];

    for (const tag of flattenedTags) {
      // Skip inactive (dropped) tags unless requested
      if (!includeDropped && !tag.active) {
        continue;
      }

      const taskCount = tag.tasks ? tag.tasks.length : 0;
      const availableTaskCount = tag.availableTasks ? tag.availableTasks.length : 0;

      tags.push({
        id: tag.id.primaryKey,
        name: tag.name,
        active: tag.active,
        taskCount: taskCount,
        availableTaskCount: availableTaskCount,
        parent: tag.parent ? tag.parent.name : null
      });
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
