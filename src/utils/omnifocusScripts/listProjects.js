// OmniJS script to list projects with optional folder filtering
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const folderName = args.folderName || null;
    const folderId = args.folderId || null;
    const statusFilter = args.status || 'active'; // active, onHold, completed, dropped, all
    const includeDroppedFolders = args.includeDroppedFolders || false;
    const limit = args.limit || 100;

    // Track optional-field read failures instead of swallowing them silently (issue #110)
    const MAX_ERROR_SAMPLES = 3;
    let metadataErrorCount = 0;
    const errorSamples = [];

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
      } catch (e) {
        // Intentionally not counted: defensive guard that returns a safe `false`
        // on folder-traversal failure rather than dropping data (issue #110)
      }
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

    // Resolve folder filter once (not per-project). folderId wins when both are
    // given, so the name is resolved only without one; an ambiguous folderName
    // sent alongside a folderId must not error.
    // Note: folderId itself is not validated. An unknown ID matches no project
    // and returns an empty list rather than an error (#148).
    const folderRef = folderName && !folderId ? resolveFolderRef(folderName, flattenedFolders) : null;
    if (folderRef && folderRef.ambiguous) {
      return JSON.stringify({
        success: false,
        error: formatAmbiguousFolderError(folderName, folderRef.matches, 'folderId'),
        count: 0,
        projects: []
      });
    }
    const resolvedFilterFolder = folderRef ? folderRef.folder : null;
    const filterFolderId = folderId || (resolvedFilterFolder ? resolvedFilterFolder.id.primaryKey : null);

    // Fail closed: a folder filter was requested but didn't resolve (typo,
    // deleted folder). Return an explicit error rather than silently matching
    // every project, which would look like a successful unfiltered result
    // (issue #117 review). Matches add_project / duplicate_project / get_folder_by_id.
    const folderFilterRequested = !!(folderId || folderName);
    if (folderFilterRequested && !filterFolderId) {
      return JSON.stringify({
        success: false,
        error: `Folder not found: "${folderName}".`,
        count: 0,
        projects: []
      });
    }

    // Helper to check if project matches folder filter.
    // Intentionally shallow: only matches direct parent, not nested subfolders.
    // Filtering by "Work" will not include projects in "Work > Subteam".
    function matchesFolder(project) {
      if (!filterFolderId) {
        return true; // No folder filter
      }

      const projectFolder = project.parentFolder;
      if (!projectFolder) {
        return false; // Project has no folder, but filter requires one
      }

      return projectFolder.id.primaryKey === filterFolderId;
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
      } catch (e) {
        metadataErrorCount++;
        if (errorSamples.length < MAX_ERROR_SAMPLES) {
          errorSamples.push(`taskCount(${project.name || 'unknown'}): ${e.message || String(e)}`);
        }
      }

      // Get folder info (full path via getFolderPath from sharedUtils)
      let projectFolderId = null;
      let projectFolderName = null;
      try {
        if (project.parentFolder) {
          projectFolderId = project.parentFolder.id.primaryKey;
          projectFolderName = getFolderPath(project.parentFolder);
        }
      } catch (e) {
        metadataErrorCount++;
        if (errorSamples.length < MAX_ERROR_SAMPLES) {
          errorSamples.push(`folder(${project.name || 'unknown'}): ${e.message || String(e)}`);
        }
      }

      // Get review date
      let nextReviewDate = null;
      try {
        if (project.nextReviewDate) {
          nextReviewDate = project.nextReviewDate.toISOString();
        }
      } catch (e) {
        metadataErrorCount++;
        if (errorSamples.length < MAX_ERROR_SAMPLES) {
          errorSamples.push(`reviewDate(${project.name || 'unknown'}): ${e.message || String(e)}`);
        }
      }

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

    const result = {
      success: true,
      count: filteredProjects.length,
      folderFilter: folderName || folderId || null,
      statusFilter: statusFilter,
      projects: filteredProjects
    };
    if (metadataErrorCount > 0) {
      result.processingErrors = { metadataErrors: metadataErrorCount, samples: errorSamples };
    }
    return JSON.stringify(result);

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error listing projects: ${error}`,
      count: 0,
      projects: []
    });
  }
})();
