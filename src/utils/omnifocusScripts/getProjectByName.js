// OmniJS script to find a project by ID or name
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const projectId = args.projectId || null;
    const projectName = args.projectName || null;

    // Track optional-field read failures instead of swallowing them silently (issue #110)
    const MAX_ERROR_SAMPLES = 3;
    let metadataErrorCount = 0;
    const errorSamples = [];

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

    // If not found by ID, search by name (case-insensitive). A name shared by
    // several projects resolves to the single live one, or fails closed (#149).
    if (!foundProject && projectName) {
      const ref = resolveProjectRef(projectName, allProjects);
      if (ref.ambiguous) {
        return JSON.stringify({
          success: false,
          error: formatAmbiguousProjectError(projectName, ref.matches, 'projectId')
        });
      }
      foundProject = ref.project;
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

    // Helper to get effective status (including "dropped with container")
    function getEffectiveStatus(project) {
      // Direct dropped status
      if (project.status === Project.Status.Dropped) {
        return "Dropped";
      }
      // Check if containing folder is dropped ("dropped with container")
      // Note: Use parentFolder property, not folder
      try {
        let folder = project.parentFolder;
        while (folder) {
          if (folder.status === Folder.Status.Dropped) {
            return "Dropped";
          }
          folder = folder.parent;
        }
      } catch (e) {
        // Intentionally not counted: defensive guard that falls back to the
        // project's own status on folder-traversal failure rather than failing (issue #110)
      }
      // Return the project's own status
      return statusMap[project.status] || "Unknown";
    }

    // Build project info
    const projectInfo = {
      id: foundProject.id.primaryKey,
      name: foundProject.name,
      note: foundProject.note || "",
      status: getEffectiveStatus(foundProject),
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
      folderName: null,
      // Review fields - ReviewInterval has .steps and .unit properties
      reviewInterval: (function() {
        try {
          const ri = foundProject.reviewInterval;
          if (ri === null || ri === undefined) return null;
          // Convert steps + unit to seconds for consistency
          const steps = ri.steps || 0;
          const unit = ri.unit || 'days';
          let seconds = steps;
          if (unit === 'days') seconds = steps * 24 * 60 * 60;
          else if (unit === 'weeks') seconds = steps * 7 * 24 * 60 * 60;
          else if (unit === 'months') seconds = steps * 30 * 24 * 60 * 60;
          else if (unit === 'years') seconds = steps * 365 * 24 * 60 * 60;
          return seconds;
        } catch (e) {
          metadataErrorCount++;
          if (errorSamples.length < MAX_ERROR_SAMPLES) {
            errorSamples.push(`reviewInterval(${foundProject.name || 'unknown'}): ${e.message || String(e)}`);
          }
          return null;
        }
      })(),
      nextReviewDate: (function() {
        try {
          return foundProject.nextReviewDate ? foundProject.nextReviewDate.toISOString() : null;
        } catch (e) {
          metadataErrorCount++;
          if (errorSamples.length < MAX_ERROR_SAMPLES) {
            errorSamples.push(`nextReviewDate(${foundProject.name || 'unknown'}): ${e.message || String(e)}`);
          }
          return null;
        }
      })(),
      lastReviewDate: (function() {
        try {
          return foundProject.lastReviewDate ? foundProject.lastReviewDate.toISOString() : null;
        } catch (e) {
          metadataErrorCount++;
          if (errorSamples.length < MAX_ERROR_SAMPLES) {
            errorSamples.push(`lastReviewDate(${foundProject.name || 'unknown'}): ${e.message || String(e)}`);
          }
          return null;
        }
      })()
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
      metadataErrorCount++;
      if (errorSamples.length < MAX_ERROR_SAMPLES) {
        errorSamples.push(`taskCount(${foundProject.name || 'unknown'}): ${e.message || String(e)}`);
      }
    }

    // Get folder info (use parentFolder, not folder)
    try {
      if (foundProject.parentFolder) {
        projectInfo.folderId = foundProject.parentFolder.id.primaryKey;
        projectInfo.folderName = foundProject.parentFolder.name;
      }
    } catch (e) {
      metadataErrorCount++;
      if (errorSamples.length < MAX_ERROR_SAMPLES) {
        errorSamples.push(`folder(${foundProject.name || 'unknown'}): ${e.message || String(e)}`);
      }
    }

    const result = {
      success: true,
      project: projectInfo
    };
    if (metadataErrorCount > 0) {
      result.processingErrors = { metadataErrors: metadataErrorCount, samples: errorSamples };
    }
    return JSON.stringify(result);

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error finding project: ${error}`
    });
  }
})();
