// OmniJS script to list projects with optional folder filtering
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const folderName = args.folderName || null;
    const folderId = args.folderId || null;
    const statusFilter = args.status || 'active'; // active, onHold, completed, dropped, all
    const includeDroppedFolders = args.includeDroppedFolders || false;
    const limit = args.limit || 100;

    // Status mapping
    const statusMap = {
      [Project.Status.Active]: "Active",
      [Project.Status.Done]: "Completed",
      [Project.Status.Dropped]: "Dropped",
      [Project.Status.OnHold]: "OnHold"
    };

    // Helper to check if project is in a dropped folder
    function isInDroppedFolder(project) {
      try {
        let folder = project.parentFolder;
        while (folder) {
          if (folder.status === Folder.Status.Dropped) {
            return true;
          }
          folder = folder.parent;
        }
      } catch (e) {}
      return false;
    }

    // Helper to get effective status
    function getEffectiveStatus(project) {
      if (project.status === Project.Status.Dropped) {
        return "Dropped";
      }
      if (isInDroppedFolder(project)) {
        return "Dropped";
      }
      return statusMap[project.status] || "Unknown";
    }

    // Helper to check if project matches folder filter
    function matchesFolder(project) {
      if (!folderName && !folderId) {
        return true; // No folder filter
      }

      const projectFolder = project.parentFolder;
      if (!projectFolder) {
        return false; // Project has no folder, but filter requires one
      }

      if (folderId && projectFolder.id.primaryKey === folderId) {
        return true;
      }
      if (folderName && projectFolder.name.toLowerCase() === folderName.toLowerCase()) {
        return true;
      }
      return false;
    }

    // Helper to check if project matches status filter
    function matchesStatus(project, effectiveStatus) {
      if (statusFilter === 'all') {
        return true;
      }

      const statusLower = statusFilter.toLowerCase();
      const effectiveLower = effectiveStatus.toLowerCase();

      if (statusLower === 'active' && effectiveLower === 'active') return true;
      if (statusLower === 'onhold' && effectiveLower === 'onhold') return true;
      if (statusLower === 'completed' && effectiveLower === 'completed') return true;
      if (statusLower === 'dropped' && effectiveLower === 'dropped') return true;

      return false;
    }

    // Filter projects
    const filteredProjects = [];

    for (const project of flattenedProjects) {
      // Check dropped folder filter
      const inDroppedFolder = isInDroppedFolder(project);
      if (inDroppedFolder && !includeDroppedFolders) {
        continue;
      }

      // Check folder filter
      if (!matchesFolder(project)) {
        continue;
      }

      // Get effective status
      const effectiveStatus = getEffectiveStatus(project);

      // Check status filter
      if (!matchesStatus(project, effectiveStatus)) {
        continue;
      }

      // Get task count
      let remainingTaskCount = 0;
      try {
        if (project.flattenedTasks) {
          remainingTaskCount = project.flattenedTasks.filter(
            t => t.taskStatus !== Task.Status.Completed && t.taskStatus !== Task.Status.Dropped
          ).length;
        }
      } catch (e) {}

      // Get folder info
      let projectFolderId = null;
      let projectFolderName = null;
      try {
        if (project.parentFolder) {
          projectFolderId = project.parentFolder.id.primaryKey;
          projectFolderName = project.parentFolder.name;
        }
      } catch (e) {}

      // Get review date
      let nextReviewDate = null;
      try {
        if (project.nextReviewDate) {
          nextReviewDate = project.nextReviewDate.toISOString();
        }
      } catch (e) {}

      filteredProjects.push({
        id: project.id.primaryKey,
        name: project.name,
        status: effectiveStatus,
        taskCount: remainingTaskCount,
        folderId: projectFolderId,
        folderName: projectFolderName,
        nextReviewDate: nextReviewDate
      });

      // Check limit
      if (filteredProjects.length >= limit) {
        break;
      }
    }

    // Sort by name
    filteredProjects.sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({
      success: true,
      count: filteredProjects.length,
      folderFilter: folderName || folderId || null,
      statusFilter: statusFilter,
      projects: filteredProjects
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error listing projects: ${error}`,
      count: 0,
      projects: []
    });
  }
})();
