// OmniJS script to generate a lightweight database checksum
// Used for cache invalidation - detects when data has changed
(() => {
  try {
    // Count entities
    const taskCount = flattenedTasks.length;
    const projectCount = flattenedProjects.length;
    const tagCount = flattenedTags.length;

    // Find latest modification time across all tasks, projects, and tags
    // This catches edits that don't change counts (e.g., renames)
    let latestMod = new Date(0);
    for (const task of flattenedTasks) {
      const mod = task.modificationDate;
      if (mod && mod > latestMod) {
        latestMod = mod;
      }
    }

    // Also check projects for modifications
    for (const project of flattenedProjects) {
      const mod = project.modificationDate;
      if (mod && mod > latestMod) {
        latestMod = mod;
      }
    }

    // Also check tags for modifications (catches tag renames)
    for (const tag of flattenedTags) {
      const mod = tag.modificationDate;
      if (mod && mod > latestMod) {
        latestMod = mod;
      }
    }

    // Generate checksum string
    // Format: taskCount-projectCount-tagCount-timestamp
    const checksum = `${taskCount}-${projectCount}-${tagCount}-${latestMod.getTime()}`;

    return JSON.stringify({
      checksum: checksum,
      taskCount: taskCount,
      projectCount: projectCount,
      tagCount: tagCount,
      latestModification: latestMod.toISOString()
    });
  } catch (error) {
    return JSON.stringify({
      error: String(error),
      checksum: ''
    });
  }
})()
