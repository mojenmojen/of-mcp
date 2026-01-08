(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const query = args.query || '';
    const matchMode = args.matchMode || 'contains';
    const searchIn = args.searchIn || 'all';
    const includeCompleted = args.includeCompleted || false;
    const projectName = args.projectName || null;
    const projectId = args.projectId || null;
    const limit = args.limit || 50;

    if (!query) {
      return JSON.stringify({
        success: false,
        error: "Search query is required"
      });
    }

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);

    // Build match function based on mode
    function matches(text) {
      if (!text) return false;
      const textLower = text.toLowerCase();

      switch (matchMode) {
        case 'exact':
          return textLower === queryLower;
        case 'anyWord':
          return queryWords.some(word => textLower.includes(word));
        case 'allWords':
          return queryWords.every(word => textLower.includes(word));
        case 'contains':
        default:
          return textLower.includes(queryLower);
      }
    }

    // Get tasks to search
    let tasks = flattenedTasks;

    // Filter by completion status
    if (!includeCompleted) {
      tasks = tasks.filter(t =>
        t.taskStatus !== Task.Status.Completed &&
        t.taskStatus !== Task.Status.Dropped
      );
    }

    // Filter by project if specified
    if (projectId || projectName) {
      let targetProjectId = projectId;
      if (!targetProjectId && projectName) {
        const nameLower = projectName.toLowerCase();
        const proj = flattenedProjects.find(p =>
          p.name.toLowerCase() === nameLower
        );
        if (proj) targetProjectId = proj.id.primaryKey;
      }

      if (targetProjectId) {
        tasks = tasks.filter(t =>
          t.containingProject && t.containingProject.id.primaryKey === targetProjectId
        );
      }
    }

    // Search
    const matchedTasks = tasks.filter(task => {
      const nameMatch = searchIn !== 'note' && matches(task.name);
      const noteMatch = searchIn !== 'name' && matches(task.note);
      return nameMatch || noteMatch;
    });

    // Map to output format with match highlights
    let result = matchedTasks.slice(0, limit).map(task => {
      const nameMatch = matches(task.name);
      const noteMatch = matches(task.note);

      return {
        id: task.id.primaryKey,
        name: task.name,
        matchedIn: nameMatch && noteMatch ? 'both' : (nameMatch ? 'name' : 'note'),
        project: task.containingProject ? task.containingProject.name : null,
        projectId: task.containingProject ? task.containingProject.id.primaryKey : null,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        completed: task.taskStatus === Task.Status.Completed,
        flagged: task.flagged,
        tags: task.tags.map(t => t.name),
        notePreview: task.note ? task.note.substring(0, 150) : null
      };
    });

    return JSON.stringify({
      success: true,
      query: query,
      matchMode: matchMode,
      totalMatches: matchedTasks.length,
      returned: result.length,
      tasks: result
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
})()
