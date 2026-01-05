// OmniJS script to batch mark projects as reviewed
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const projectIds = args.projectIds || [];

    if (!projectIds || projectIds.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No project IDs provided"
      });
    }

    // Build Map for O(1) lookup
    const projectsById = new Map();
    flattenedProjects.forEach(p => projectsById.set(p.id.primaryKey, p));

    // Mark each project as reviewed
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const id of projectIds) {
      const project = projectsById.get(id);
      if (project) {
        try {
          // Try markReviewed() first
          if (typeof project.markReviewed === 'function') {
            project.markReviewed();
          } else {
            // Fallback: manually advance next review date
            let intervalSeconds = null;
            const ri = project.reviewInterval;
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
              project.nextReviewDate = nextDate;
            }
          }
          results.push({
            id: id,
            name: project.name,
            success: true,
            nextReviewDate: project.nextReviewDate ? project.nextReviewDate.toISOString() : null
          });
          successCount++;
        } catch (e) {
          results.push({
            id: id,
            name: project.name,
            success: false,
            error: `Failed to mark reviewed: ${e}`
          });
          failCount++;
        }
      } else {
        results.push({
          id: id,
          success: false,
          error: "Project not found"
        });
        failCount++;
      }
    }

    return JSON.stringify({
      success: failCount === 0,
      totalCount: projectIds.length,
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
