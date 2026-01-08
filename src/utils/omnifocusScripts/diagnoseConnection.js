// OmniJS script to diagnose OmniFocus connection
(() => {
  try {
    const version = app.version;

    // Check feature availability (more robust than license detection)
    let customPerspectivesAvailable = false;
    let customPerspectiveCount = 0;
    try {
      if (typeof Perspective !== 'undefined' && Perspective.Custom) {
        customPerspectiveCount = Perspective.Custom.all.length;
        customPerspectivesAvailable = true;
      }
    } catch (e) {
      customPerspectivesAvailable = false;
    }

    // Get basic counts to verify database access
    const taskCount = flattenedTasks.length;
    const projectCount = flattenedProjects.length;
    const tagCount = flattenedTags.length;

    return JSON.stringify({
      success: true,
      version: version,
      features: {
        customPerspectives: customPerspectivesAvailable,
        customPerspectiveCount: customPerspectiveCount
      },
      taskCount: taskCount,
      projectCount: projectCount,
      tagCount: tagCount
    });
  } catch (e) {
    return JSON.stringify({
      success: false,
      error: e.message
    });
  }
})()
