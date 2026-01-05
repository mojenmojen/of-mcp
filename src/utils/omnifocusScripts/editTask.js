// OmniJS script to edit a task
// This avoids AppleScript escaping issues with special characters like $
(() => {
  // Helper function to build iCal RRULE string from repetition rule object
  function buildRRule(rule) {
    let rrule = `FREQ=${rule.frequency.toUpperCase()}`;
    if (rule.interval && rule.interval > 1) {
      rrule += `;INTERVAL=${rule.interval}`;
    }
    if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const days = rule.daysOfWeek.map(d => dayMap[d]).join(',');
      rrule += `;BYDAY=${days}`;
    }
    if (rule.dayOfMonth) {
      rrule += `;BYMONTHDAY=${rule.dayOfMonth}`;
    }
    if (rule.month) {
      rrule += `;BYMONTH=${rule.month}`;
    }
    return rrule;
  }

  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const taskId = args.id || null;
    const taskName = args.name || null;
    const itemType = args.itemType || 'task';

    if (!taskId && !taskName) {
      return JSON.stringify({
        success: false,
        error: "Either id or name must be provided"
      });
    }

    // Build lookup Maps for O(1) access (optimization for multiple lookups)
    const projectsByName = new Map();
    const projectsById = new Map();
    flattenedProjects.forEach(p => {
      projectsByName.set(p.name.toLowerCase(), p);
      projectsById.set(p.id.primaryKey, p);
    });

    const tasksByName = new Map();
    const tasksById = new Map();
    flattenedTasks.forEach(t => {
      // Only store first match for name (consistent with previous behavior)
      if (!tasksByName.has(t.name.toLowerCase())) {
        tasksByName.set(t.name.toLowerCase(), t);
      }
      tasksById.set(t.id.primaryKey, t);
    });

    const tagsByName = new Map();
    flattenedTags.forEach(t => tagsByName.set(t.name.toLowerCase(), t));

    const foldersByName = new Map();
    flattenedFolders.forEach(f => foldersByName.set(f.name.toLowerCase(), f));

    // Find the item using Maps
    let foundItem = null;

    if (itemType === 'project') {
      // Search by ID first, then by name
      if (taskId) {
        foundItem = projectsById.get(taskId);
      }
      if (!foundItem && taskName) {
        foundItem = projectsByName.get(taskName.toLowerCase());
      }
    } else {
      // Search by ID first, then by name
      if (taskId) {
        foundItem = tasksById.get(taskId);
      }
      if (!foundItem && taskName) {
        foundItem = tasksByName.get(taskName.toLowerCase());
      }
    }

    if (!foundItem) {
      return JSON.stringify({
        success: false,
        error: "Item not found"
      });
    }

    const changedProperties = [];
    const originalName = foundItem.name;
    const originalId = foundItem.id.primaryKey;

    // Apply changes

    // New name
    if (args.newName !== undefined) {
      foundItem.name = args.newName;
      changedProperties.push("name");
    }

    // New note
    if (args.newNote !== undefined) {
      foundItem.note = args.newNote;
      changedProperties.push("note");
    }

    // Due date
    if (args.newDueDate !== undefined) {
      if (args.newDueDate === "" || args.newDueDate === null) {
        foundItem.dueDate = null;
      } else {
        foundItem.dueDate = new Date(args.newDueDate);
      }
      changedProperties.push("due date");
    }

    // Defer date
    if (args.newDeferDate !== undefined) {
      if (args.newDeferDate === "" || args.newDeferDate === null) {
        foundItem.deferDate = null;
      } else {
        foundItem.deferDate = new Date(args.newDeferDate);
      }
      changedProperties.push("defer date");
    }

    // Planned date
    if (args.newPlannedDate !== undefined) {
      if (args.newPlannedDate === "" || args.newPlannedDate === null) {
        foundItem.plannedDate = null;
      } else {
        foundItem.plannedDate = new Date(args.newPlannedDate);
      }
      changedProperties.push("planned date");
    }

    // Flagged
    if (args.newFlagged !== undefined) {
      foundItem.flagged = args.newFlagged;
      changedProperties.push("flagged");
    }

    // Estimated minutes
    if (args.newEstimatedMinutes !== undefined) {
      foundItem.estimatedMinutes = args.newEstimatedMinutes;
      changedProperties.push("estimated minutes");
    }

    // Task-specific: Status changes
    if (itemType === 'task' && args.newStatus !== undefined) {
      if (args.newStatus === 'completed') {
        foundItem.markComplete();
        changedProperties.push("status (completed)");
      } else if (args.newStatus === 'dropped') {
        // drop(true) = drop completely (no future occurrences for repeating tasks)
        // drop(false) = drop this occurrence only (repeating tasks create next occurrence)
        const dropCompletely = args.dropCompletely === true;
        foundItem.drop(dropCompletely);
        changedProperties.push(dropCompletely ? "status (dropped completely)" : "status (dropped)");
      } else if (args.newStatus === 'incomplete') {
        foundItem.markIncomplete();
        changedProperties.push("status (incomplete)");
      }
    }

    // Task-specific: Move to inbox
    if (itemType === 'task' && args.moveToInbox === true) {
      // Move to inbox by removing from project
      foundItem.assignedContainer = null;
      changedProperties.push("moved to inbox");
    }

    // Task-specific: Move to different project (using Map lookup)
    if (itemType === 'task' && args.newProjectName) {
      const targetProject = projectsByName.get(args.newProjectName.toLowerCase());
      if (targetProject) {
        moveTasks([foundItem], targetProject);
        changedProperties.push("moved to project");
      } else {
        return JSON.stringify({
          success: false,
          error: `Project not found: ${args.newProjectName}`
        });
      }
    }

    // Task-specific: Move to parent task (using Map lookup)
    if (itemType === 'task' && (args.newParentTaskId || args.newParentTaskName)) {
      let targetParent = null;

      if (args.newParentTaskId) {
        targetParent = tasksById.get(args.newParentTaskId);
      }

      if (!targetParent && args.newParentTaskName) {
        targetParent = tasksByName.get(args.newParentTaskName.toLowerCase());
      }

      if (targetParent) {
        moveTasks([foundItem], targetParent);
        changedProperties.push("moved to parent task");
      } else {
        return JSON.stringify({
          success: false,
          error: "Parent task not found"
        });
      }
    }

    // Task-specific: Replace all tags (using Map lookup)
    if (itemType === 'task' && args.replaceTags && args.replaceTags.length > 0) {
      // First, remove all existing tags
      const existingTags = foundItem.tags.slice(); // Make a copy
      for (const existingTag of existingTags) {
        foundItem.removeTag(existingTag);
      }
      // Then add new tags using Map lookup
      for (const tagName of args.replaceTags) {
        const tag = tagsByName.get(tagName.toLowerCase());
        if (tag) {
          foundItem.addTag(tag);
        }
      }
      changedProperties.push("tags (replaced)");
    } else {
      // Task-specific: Add tags (using Map lookup)
      if (itemType === 'task' && args.addTags && args.addTags.length > 0) {
        for (const tagName of args.addTags) {
          const tag = tagsByName.get(tagName.toLowerCase());
          if (tag) {
            foundItem.addTag(tag);
          }
        }
        changedProperties.push("tags (added)");
      }

      // Task-specific: Remove tags (using Map lookup)
      if (itemType === 'task' && args.removeTags && args.removeTags.length > 0) {
        for (const tagName of args.removeTags) {
          const tag = tagsByName.get(tagName.toLowerCase());
          if (tag) {
            foundItem.removeTag(tag);
          }
        }
        changedProperties.push("tags (removed)");
      }
    }

    // Task-specific: Set or remove repetition rule
    if (itemType === 'task' && args.newRepetitionRule !== undefined) {
      if (args.newRepetitionRule === null) {
        // Remove repetition
        foundItem.repetitionRule = null;
        changedProperties.push("repetition (removed)");
      } else if (args.newRepetitionRule && args.newRepetitionRule.frequency) {
        // Set new repetition rule
        try {
          const rruleString = buildRRule(args.newRepetitionRule);
          const repeatFromCompletion = args.newRepetitionRule.repeatFrom === 'completion';

          if (repeatFromCompletion) {
            foundItem.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DeferUntilDate);
          } else {
            foundItem.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DueDate);
          }
          changedProperties.push("repetition");
        } catch (repError) {
          return JSON.stringify({
            success: false,
            error: `Failed to set repetition rule: ${repError}`
          });
        }
      }
    }

    // Project-specific: Sequential
    if (itemType === 'project' && args.newSequential !== undefined) {
      foundItem.sequential = args.newSequential;
      changedProperties.push("sequential");
    }

    // Project-specific: Status
    if (itemType === 'project' && args.newProjectStatus !== undefined) {
      if (args.newProjectStatus === 'active') {
        foundItem.status = Project.Status.Active;
      } else if (args.newProjectStatus === 'completed') {
        foundItem.markComplete();
      } else if (args.newProjectStatus === 'dropped') {
        foundItem.drop(false);
      } else if (args.newProjectStatus === 'onHold') {
        foundItem.status = Project.Status.OnHold;
      }
      changedProperties.push("status");
    }

    // Project-specific: Move to folder (using Map lookup)
    if (itemType === 'project' && args.newFolderName) {
      const targetFolder = foldersByName.get(args.newFolderName.toLowerCase());
      if (targetFolder) {
        moveSections([foundItem], targetFolder);
        changedProperties.push("moved to folder");
      } else {
        // Create the folder if it doesn't exist
        const newFolder = new Folder(args.newFolderName);
        moveSections([foundItem], newFolder);
        changedProperties.push("moved to new folder");
      }
    }

    return JSON.stringify({
      success: true,
      id: originalId,
      name: originalName,
      changedProperties: changedProperties.join(", ")
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error editing item: ${error}`
    });
  }
})();
