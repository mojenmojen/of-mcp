// OmniJS script to get projects that need review
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const includeOnHold = args.includeOnHold || false;
    const limit = args.limit || 50;

    const now = new Date();

    // Get project status string
    const statusMap = {
      [Project.Status.Active]: "Active",
      [Project.Status.Done]: "Done",
      [Project.Status.Dropped]: "Dropped",
      [Project.Status.OnHold]: "OnHold"
    };

    // Helper to check if project is effectively dropped (including via container)
    function isEffectivelyDropped(project) {
      // Check direct dropped status
      if (project.status === Project.Status.Dropped) {
        return true;
      }
      // Check if containing folder is dropped ("dropped with container")
      // Note: Use parentFolder property, not folder
      try {
        let folder = project.parentFolder;
        while (folder) {
          if (folder.status === Folder.Status.Dropped) {
            return true;
          }
          folder = folder.parent; // Check parent folders too
        }
      } catch (e) {}
      return false;
    }

    // Filter projects that need review
    const projectsNeedingReview = flattenedProjects.filter(project => {
      // Skip completed or dropped projects (including dropped with container)
      if (project.status === Project.Status.Done || isEffectivelyDropped(project)) {
        return false;
      }
      // Skip on-hold projects unless explicitly included
      if (!includeOnHold && project.status === Project.Status.OnHold) {
        return false;
      }
      // Skip projects without a next review date
      if (!project.nextReviewDate) {
        return false;
      }
      // Include if next review date is in the past or today
      return project.nextReviewDate <= now;
    });

    // Sort by next review date (oldest first)
    projectsNeedingReview.sort((a, b) => {
      const dateA = a.nextReviewDate || new Date('9999-12-31');
      const dateB = b.nextReviewDate || new Date('9999-12-31');
      return dateA - dateB;
    });

    // Apply limit
    const limitedProjects = projectsNeedingReview.slice(0, limit);

    // Build result
    const projects = limitedProjects.map(project => {
      let folderId = null;
      let folderName = null;
      try {
        if (project.folder) {
          folderId = project.folder.id.primaryKey;
          folderName = project.folder.name;
        }
      } catch (e) {
        // Folder not accessible
      }

      let remainingTaskCount = 0;
      try {
        if (project.flattenedTasks) {
          remainingTaskCount = project.flattenedTasks.filter(
            t => t.taskStatus !== Task.Status.Completed && t.taskStatus !== Task.Status.Dropped
          ).length;
        }
      } catch (e) {
        // Task count not accessible
      }

      // Get review interval - ReviewInterval has .steps and .unit properties
      let reviewIntervalSeconds = null;
      try {
        const ri = project.reviewInterval;
        if (ri !== null && ri !== undefined) {
          const steps = ri.steps || 0;
          const unit = ri.unit || 'days';
          if (unit === 'days') reviewIntervalSeconds = steps * 24 * 60 * 60;
          else if (unit === 'weeks') reviewIntervalSeconds = steps * 7 * 24 * 60 * 60;
          else if (unit === 'months') reviewIntervalSeconds = steps * 30 * 24 * 60 * 60;
          else if (unit === 'years') reviewIntervalSeconds = steps * 365 * 24 * 60 * 60;
          else reviewIntervalSeconds = steps;
        }
      } catch (e) {}

      return {
        id: project.id.primaryKey,
        name: project.name,
        status: statusMap[project.status] || "Unknown",
        remainingTaskCount: remainingTaskCount,
        folderId: folderId,
        folderName: folderName,
        reviewInterval: reviewIntervalSeconds,
        nextReviewDate: project.nextReviewDate ? project.nextReviewDate.toISOString() : null,
        lastReviewDate: project.lastReviewDate ? project.lastReviewDate.toISOString() : null
      };
    });

    return JSON.stringify({
      success: true,
      totalCount: projectsNeedingReview.length,
      returnedCount: projects.length,
      projects: projects
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error getting projects for review: ${error}`
    });
  }
})();
