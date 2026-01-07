// OmniJS script to batch mark projects as reviewed
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const projectIds = args.projectIds || [];
    const projectNames = args.projectNames || [];

    if (projectIds.length === 0 && projectNames.length === 0) {
      return JSON.stringify({
        success: false,
        error: "Must provide either projectIds or projectNames"
      });
    }

    // Build Maps for O(1) lookup
    const projectsById = new Map();
    const projectsByName = new Map();
    flattenedProjects.forEach(p => {
      projectsById.set(p.id.primaryKey, p);
      projectsByName.set(p.name.toLowerCase(), p);
    });

    // Collect projects to mark reviewed - IDs take priority
    const projectsToMark = [];

    // Add projects by ID first
    for (const id of projectIds) {
      const project = projectsById.get(id);
      if (project) {
        projectsToMark.push({ project, identifier: id, type: 'id' });
      } else {
        projectsToMark.push({ project: null, identifier: id, type: 'id', error: 'Project not found' });
      }
    }

    // Add projects by name (if not already added by ID)
    const addedProjectIds = new Set(projectsToMark.filter(p => p.project).map(p => p.project.id.primaryKey));
    for (const name of projectNames) {
      const project = projectsByName.get(name.toLowerCase());
      if (project) {
        // Only add if not already added by ID
        if (!addedProjectIds.has(project.id.primaryKey)) {
          projectsToMark.push({ project, identifier: name, type: 'name' });
          addedProjectIds.add(project.id.primaryKey);
        }
      } else {
        projectsToMark.push({ project: null, identifier: name, type: 'name', error: 'Project not found' });
      }
    }

    // Mark each project as reviewed
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of projectsToMark) {
      if (item.project) {
        try {
          // Try markReviewed() first
          if (typeof item.project.markReviewed === 'function') {
            item.project.markReviewed();
          } else {
            // Fallback: manually advance next review date
            let intervalSeconds = null;
            const ri = item.project.reviewInterval;
            if (ri !== null && ri !== undefined) {
              // ReviewInterval has .steps and .unit properties
              const steps = ri.steps || 0;
              const unit = ri.unit || 'days';
              if (unit === 'days') intervalSeconds = steps * 24 * 60 * 60;
              else if (unit === 'weeks') intervalSeconds = steps * 7 * 24 * 60 * 60;
              else if (unit === 'months') intervalSeconds = steps * 30 * 24 * 60 * 60;
              else if (unit === 'years') intervalSeconds = steps * 365 * 24 * 60 * 60;
            }
            if (intervalSeconds) {
              const nextDate = new Date();
              nextDate.setTime(nextDate.getTime() + (intervalSeconds * 1000));
              item.project.nextReviewDate = nextDate;
            }
          }
          results.push({
            id: item.project.id.primaryKey,
            name: item.project.name,
            success: true,
            nextReviewDate: item.project.nextReviewDate ? item.project.nextReviewDate.toISOString() : null
          });
          successCount++;
        } catch (e) {
          results.push({
            id: item.project.id.primaryKey,
            name: item.project.name,
            success: false,
            error: `Failed to mark reviewed: ${e}`
          });
          failCount++;
        }
      } else {
        results.push({
          id: item.type === 'id' ? item.identifier : null,
          name: item.type === 'name' ? item.identifier : null,
          success: false,
          error: item.error || "Project not found"
        });
        failCount++;
      }
    }

    return JSON.stringify({
      success: failCount === 0,
      totalCount: projectsToMark.length,
      successCount: successCount,
      failCount: failCount,
      results: results
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error batch marking reviewed: ${error}`
    });
  }
})();
