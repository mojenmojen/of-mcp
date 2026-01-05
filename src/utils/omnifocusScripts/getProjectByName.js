// OmniJS script to find a project by ID or name
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const projectId = args.projectId || null;
    const projectName = args.projectName || null;

    if (!projectId && !projectName) {
      return JSON.stringify({
        success: false,
        error: "Either projectId or projectName must be provided"
      });
    }

    // Get all flattened projects
    const allProjects = flattenedProjects;
    let foundProject = null;

    // Search by ID first (most reliable)
    if (projectId) {
      for (const project of allProjects) {
        if (project.id.primaryKey === projectId) {
          foundProject = project;
          break;
        }
      }
    }

    // If not found by ID, search by name (case-insensitive)
    if (!foundProject && projectName) {
      const projectNameLower = projectName.toLowerCase();
      for (const project of allProjects) {
        if (project.name.toLowerCase() === projectNameLower) {
          foundProject = project;
          break;
        }
      }
    }

    if (!foundProject) {
      return JSON.stringify({
        success: false,
        error: "Project not found"
      });
    }

    // Get project status string
    const statusMap = {
      [Project.Status.Active]: "Active",
      [Project.Status.Done]: "Done",
      [Project.Status.Dropped]: "Dropped",
      [Project.Status.OnHold]: "OnHold"
    };

    // Build project info
    const projectInfo = {
      id: foundProject.id.primaryKey,
      name: foundProject.name,
      note: foundProject.note || "",
      status: statusMap[foundProject.status] || "Unknown",
      sequential: foundProject.sequential,
      flagged: foundProject.flagged,
      dueDate: foundProject.dueDate ? foundProject.dueDate.toISOString() : null,
      deferDate: foundProject.deferDate ? foundProject.deferDate.toISOString() : null,
      estimatedMinutes: foundProject.estimatedMinutes || null,
      completedByChildren: foundProject.completedByChildren,
      containsSingletonActions: foundProject.containsSingletonActions,
      taskCount: 0,
      remainingTaskCount: 0,
      folderId: null,
      folderName: null
    };

    // Get task counts
    try {
      if (foundProject.flattenedTasks) {
        projectInfo.taskCount = foundProject.flattenedTasks.length;
        projectInfo.remainingTaskCount = foundProject.flattenedTasks.filter(
          t => t.taskStatus !== Task.Status.Completed && t.taskStatus !== Task.Status.Dropped
        ).length;
      }
    } catch (e) {
      // Task count not accessible
    }

    // Get folder info
    try {
      if (foundProject.folder) {
        projectInfo.folderId = foundProject.folder.id.primaryKey;
        projectInfo.folderName = foundProject.folder.name;
      }
    } catch (e) {
      // Folder not accessible
    }

    return JSON.stringify({
      success: true,
      project: projectInfo
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error finding project: ${error}`
    });
  }
})();
