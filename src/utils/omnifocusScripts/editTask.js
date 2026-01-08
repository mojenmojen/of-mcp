// OmniJS script to edit a task
// This avoids AppleScript escaping issues with special characters like $
(() => {
  // Helper function to parse date strings as local time
  // Fixes issue where "2026-02-04" would be interpreted as midnight UTC
  // which shifts the date when in timezones behind UTC
  function parseLocalDate(dateStr) {
    // Check if it's a date-only format (YYYY-MM-DD)
    const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      // Parse as local time by using year, month, day constructor
      const year = parseInt(dateOnlyMatch[1], 10);
      const month = parseInt(dateOnlyMatch[2], 10) - 1; // JS months are 0-indexed
      const day = parseInt(dateOnlyMatch[3], 10);
      return new Date(year, month, day);
    }
    // Otherwise use standard parsing (includes time component)
    return new Date(dateStr);
  }

  // Helper function to find a tag by name (direct iteration to keep OmniJS proxy alive)
  // If tag doesn't exist, creates it
  function findOrCreateTag(tagName) {
    const tagNameLower = tagName.toLowerCase();
    for (const tag of flattenedTags) {
      if (tag.name.toLowerCase() === tagNameLower) {
        return tag;
      }
    }
    // Tag doesn't exist - create it
    return new Tag(tagName);
  }

  // Helper function to find a tag by name (for removal - don't create if missing)
  function findTag(tagName) {
    const tagNameLower = tagName.toLowerCase();
    for (const tag of flattenedTags) {
      if (tag.name.toLowerCase() === tagNameLower) {
        return tag;
      }
    }
    return null;
  }

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
    if (rule.weekdayOfMonth) {
      // Weekday-of-month pattern: e.g., first Monday, last Friday
      const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const dayCode = dayMap[rule.weekdayOfMonth.day];
      rrule += `;BYDAY=${dayCode};BYSETPOS=${rule.weekdayOfMonth.week}`;
    } else if (rule.dayOfMonth) {
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
        foundItem.dueDate = parseLocalDate(args.newDueDate);
      }
      changedProperties.push("due date");
    }

    // Defer date
    if (args.newDeferDate !== undefined) {
      if (args.newDeferDate === "" || args.newDeferDate === null) {
        foundItem.deferDate = null;
      } else {
        foundItem.deferDate = parseLocalDate(args.newDeferDate);
      }
      changedProperties.push("defer date");
    }

    // Planned date
    if (args.newPlannedDate !== undefined) {
      if (args.newPlannedDate === "" || args.newPlannedDate === null) {
        foundItem.plannedDate = null;
      } else {
        foundItem.plannedDate = parseLocalDate(args.newPlannedDate);
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
      // Move to inbox using moveTasks() with inbox.ending insertion location
      moveTasks([foundItem], inbox.ending);
      changedProperties.push("moved to inbox");
    }

    // Task-specific: Move to different project (using Map lookup - ID takes priority)
    if (itemType === 'task' && (args.newProjectId || args.newProjectName)) {
      let targetProject = null;

      // Try ID first
      if (args.newProjectId) {
        targetProject = projectsById.get(args.newProjectId);
      }

      // Fall back to name if ID not found or not provided
      if (!targetProject && args.newProjectName) {
        targetProject = projectsByName.get(args.newProjectName.toLowerCase());
      }

      if (targetProject) {
        moveTasks([foundItem], targetProject);
        changedProperties.push("moved to project");
      } else {
        const searchRef = args.newProjectId ? `ID "${args.newProjectId}"` : `name "${args.newProjectName}"`;
        return JSON.stringify({
          success: false,
          error: `Project not found with ${searchRef}`
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

    // Task-specific: Replace all tags (direct iteration to keep OmniJS proxy alive)
    if (itemType === 'task' && args.replaceTags && args.replaceTags.length > 0) {
      // First, remove all existing tags
      const existingTags = foundItem.tags.slice(); // Make a copy
      for (const existingTag of existingTags) {
        foundItem.removeTag(existingTag);
      }
      // Then add new tags (creates if missing)
      for (const tagName of args.replaceTags) {
        const tag = findOrCreateTag(tagName);
        foundItem.addTag(tag);
      }
      changedProperties.push("tags (replaced)");
    } else {
      // Task-specific: Add tags (direct iteration, creates if missing)
      if (itemType === 'task' && args.addTags && args.addTags.length > 0) {
        for (const tagName of args.addTags) {
          const tag = findOrCreateTag(tagName);
          foundItem.addTag(tag);
        }
        changedProperties.push("tags (added)");
      }

      // Task-specific: Remove tags (direct iteration)
      if (itemType === 'task' && args.removeTags && args.removeTags.length > 0) {
        for (const tagName of args.removeTags) {
          const tag = findTag(tagName);
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
        // Projects use status property, not drop() method
        foundItem.status = Project.Status.Dropped;
      } else if (args.newProjectStatus === 'onHold') {
        foundItem.status = Project.Status.OnHold;
      }
      changedProperties.push("status");
    }

    // Project-specific: Move to folder (using Map lookup - ID takes priority)
    if (itemType === 'project' && (args.newFolderId || args.newFolderName)) {
      let targetFolder = null;

      // Try ID first
      if (args.newFolderId) {
        // Build folder ID map if not already done
        const foldersById = new Map();
        flattenedFolders.forEach(f => foldersById.set(f.id.primaryKey, f));
        targetFolder = foldersById.get(args.newFolderId);
      }

      // Fall back to name if ID not found or not provided
      if (!targetFolder && args.newFolderName) {
        targetFolder = foldersByName.get(args.newFolderName.toLowerCase());
      }

      if (targetFolder) {
        // Check if project is already in this folder
        const currentFolder = foundItem.parentFolder;
        if (currentFolder && currentFolder.id.primaryKey === targetFolder.id.primaryKey) {
          // Already in target folder - no change needed
          changedProperties.push("already in folder");
        } else {
          moveSections([foundItem], targetFolder);
          changedProperties.push("moved to folder");
        }
      } else if (args.newFolderId) {
        // If ID was provided but not found, return error
        return JSON.stringify({
          success: false,
          error: `Folder not found with ID "${args.newFolderId}"`
        });
      } else {
        // Create the folder if only name was provided and not found
        const newFolder = new Folder(args.newFolderName);
        moveSections([foundItem], newFolder);
        changedProperties.push("moved to new folder");
      }
    }

    // Project-specific: Mark as reviewed
    if (itemType === 'project' && args.markReviewed === true) {
      try {
        // Try the standard markReviewed method
        if (typeof foundItem.markReviewed === 'function') {
          foundItem.markReviewed();
          changedProperties.push("marked as reviewed");
        } else {
          // Fallback: manually advance next review date based on interval
          let intervalSeconds = null;
          const ri = foundItem.reviewInterval;
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
            foundItem.nextReviewDate = nextDate;
            changedProperties.push("next review date");
          } else {
            changedProperties.push("marked as reviewed (no interval set)");
          }
        }
      } catch (e) {
        return JSON.stringify({
          success: false,
          error: `Failed to mark reviewed: ${e}`
        });
      }
    }

    // Project-specific: Set review interval
    // Project.ReviewInterval is a value object with .steps and .unit properties
    if (itemType === 'project' && args.newReviewInterval !== undefined) {
      try {
        const days = args.newReviewInterval;

        // Get the existing review interval or get a default one
        let reviewInterval = foundItem.reviewInterval;

        if (!reviewInterval) {
          // Project may not have a review interval set - we need to create one
          // Try getting a template from any other project, or create a default
          try {
            // Look for a project with an existing interval to use as template
            for (const proj of flattenedProjects) {
              if (proj.reviewInterval) {
                reviewInterval = proj.reviewInterval;
                break;
              }
            }
          } catch (e) {}
        }

        if (reviewInterval) {
          // Modify the interval: set steps to the number of days, unit to "days"
          reviewInterval.steps = days;
          reviewInterval.unit = "days";
          foundItem.reviewInterval = reviewInterval;
          changedProperties.push("review interval");
        } else {
          // Can't set interval - no template available
          return JSON.stringify({
            success: false,
            error: `Cannot set review interval - project has no existing interval to modify`
          });
        }
      } catch (e) {
        return JSON.stringify({
          success: false,
          error: `Failed to set review interval: ${e}`
        });
      }
    }

    // Project-specific: Set next review date directly
    if (itemType === 'project' && args.newNextReviewDate !== undefined) {
      try {
        if (args.newNextReviewDate === "" || args.newNextReviewDate === null) {
          foundItem.nextReviewDate = null;
          changedProperties.push("next review date (cleared)");
        } else {
          foundItem.nextReviewDate = parseLocalDate(args.newNextReviewDate);
          changedProperties.push("next review date");
        }
      } catch (e) {
        return JSON.stringify({
          success: false,
          error: `Failed to set next review date: ${e}`
        });
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
