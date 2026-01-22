// Get tasks by custom perspective name (with hierarchy support)
// Based on improved user-provided code

(() => {
  // Runtime injection: injectedArgs, perspectiveName, perspectiveId, and other
  // parameters are injected by executeOmniFocusScript() before this code runs.
  // See scriptExecution.ts for the full list of injected variables.
  let originalFocus = null;
  let focusWasActive = false;
  let focusCleared = false;
  let ignoreFocus = true;
  let focusTarget = null;

  try {
    // Get Focus state BEFORE any operations
    originalFocus = document.focus;
    focusWasActive = originalFocus !== null;
    focusTarget = focusWasActive ? {
      name: originalFocus.name || '[unnamed]',
      type: originalFocus instanceof Project ? "project" :
            originalFocus instanceof Folder ? "folder" :
            originalFocus instanceof Tag ? "tag" : "unknown"
    } : null;

    // Clear Focus if ignoreFocus is true (default)
    ignoreFocus = injectedArgs && injectedArgs.ignoreFocus !== undefined
      ? injectedArgs.ignoreFocus
      : true;

    if (ignoreFocus && focusWasActive) {
      document.focus = null;
      focusCleared = true;
    }

    if (!perspectiveName && !perspectiveId) {
      throw new Error("Must provide either perspectiveName or perspectiveId");
    }

    // Get custom perspective - ID takes priority over name
    let perspective = null;
    if (perspectiveId) {
      // Find perspective by ID
      const allPerspectives = Perspective.Custom.all;
      for (const p of allPerspectives) {
        if (p.identifier === perspectiveId) {
          perspective = p;
          break;
        }
      }
      if (!perspective) {
        throw new Error(`Custom perspective not found with ID: "${perspectiveId}"`);
      }
    } else if (perspectiveName) {
      perspective = Perspective.Custom.byName(perspectiveName);
      if (!perspective) {
        throw new Error(`Custom perspective not found: "${perspectiveName}"`);
      }
    }

    // Switch to the specified perspective
    document.windows[0].perspective = perspective;

    // Store all tasks, key is task ID (supports hierarchy)
    let taskMap = {};

    // Traverse content tree, collect task info (with hierarchy)
    let rootNode = document.windows[0].content.rootNode;

    function collectTasks(node, parentId) {
      if (node.object && node.object instanceof Task) {
        let t = node.object;
        let id = t.id.primaryKey;

        // Record task info (including hierarchy)
        taskMap[id] = {
          id: id,
          name: t.name,
          note: t.note || "",
          project: t.project ? t.project.name : null,
          tags: t.tags ? t.tags.map(tag => tag.name) : [],
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          deferDate: t.deferDate ? t.deferDate.toISOString() : null,
          plannedDate: t.plannedDate ? t.plannedDate.toISOString() : null,
          completed: t.completed,
          flagged: t.flagged,
          estimatedMinutes: t.estimatedMinutes || null,
          repetitionRule: t.repetitionRule ? t.repetitionRule.toString() : null,
          createdDate: t.added ? t.added.toISOString() : null,
          completionDate: t.completedDate ? t.completedDate.toISOString() : null,
          parent: parentId,     // Parent task ID
          children: [],         // Child task IDs, populated below
        };

        // Recursively collect child tasks
        node.children.forEach(childNode => {
          if (childNode.object && childNode.object instanceof Task) {
            let childId = childNode.object.id.primaryKey;
            taskMap[id].children.push(childId);
            collectTasks(childNode, id);
          } else {
            collectTasks(childNode, id);
          }
        });
      } else {
        // Not a task node, recurse child nodes
        node.children.forEach(childNode => collectTasks(childNode, parentId));
      }
    }

    // Start collecting tasks (root tasks have parent=null)
    if (rootNode && rootNode.children) {
      rootNode.children.forEach(node => collectTasks(node, null));
    }

    // Calculate task count
    const taskCount = Object.keys(taskMap).length;

    // Return result (including hierarchy structure)
    // Use perspective.name to get the actual name (works for both name and ID lookup)
    const result = {
      success: true,
      perspectiveName: perspective.name,
      perspectiveId: perspective.identifier,
      count: taskCount,
      taskMap: taskMap,
      focus: {
        wasActive: focusWasActive,
        cleared: focusCleared,
        target: focusTarget
      }
    };

    return JSON.stringify(result);

  } catch (error) {
    // Error handling
    const errorResult = {
      success: false,
      error: error.message || String(error),
      perspectiveName: perspectiveName,
      perspectiveId: perspectiveId,
      count: 0,
      taskMap: {}
    };

    return JSON.stringify(errorResult);

  } finally {
    // ALWAYS restore Focus if we cleared it
    if (focusCleared && originalFocus) {
      try {
        document.focus = originalFocus;
      } catch (restoreError) {
        // Silently ignore restore errors - original operation result takes priority
      }
    }
  }
})();
