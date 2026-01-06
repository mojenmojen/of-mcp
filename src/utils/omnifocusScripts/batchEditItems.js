// OmniJS script to edit multiple items in a single execution
// This provides true batching - all edits happen in one OmniFocus session
(() => {
  // Helper function to parse date strings as local time
  function parseLocalDate(dateStr) {
    const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const year = parseInt(dateOnlyMatch[1], 10);
      const month = parseInt(dateOnlyMatch[2], 10) - 1;
      const day = parseInt(dateOnlyMatch[3], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
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
    const edits = args.edits || [];

    if (!edits || edits.length === 0) {
      return JSON.stringify({
        success: false,
        error: "No edits provided"
      });
    }

    // Lazy-load lookup Maps only when needed
    let projectsByName = null;
    let projectsById = null;
    let tasksByName = null;
    let tasksById = null;
    let tagsByName = null;
    let foldersByName = null;

    function getProjectsByName() {
      if (!projectsByName) {
        projectsByName = new Map();
        flattenedProjects.forEach(p => projectsByName.set(p.name.toLowerCase(), p));
      }
      return projectsByName;
    }

    function getProjectsById() {
      if (!projectsById) {
        projectsById = new Map();
        flattenedProjects.forEach(p => projectsById.set(p.id.primaryKey, p));
      }
      return projectsById;
    }

    function getTasksByName() {
      if (!tasksByName) {
        tasksByName = new Map();
        flattenedTasks.forEach(t => {
          if (!tasksByName.has(t.name.toLowerCase())) {
            tasksByName.set(t.name.toLowerCase(), t);
          }
        });
      }
      return tasksByName;
    }

    function getTasksById() {
      if (!tasksById) {
        tasksById = new Map();
        flattenedTasks.forEach(t => tasksById.set(t.id.primaryKey, t));
      }
      return tasksById;
    }

    function getTagsByName() {
      if (!tagsByName) {
        tagsByName = new Map();
        flattenedTags.forEach(t => tagsByName.set(t.name.toLowerCase(), t));
      }
      return tagsByName;
    }

    function getFoldersByName() {
      if (!foldersByName) {
        foldersByName = new Map();
        flattenedFolders.forEach(f => foldersByName.set(f.name.toLowerCase(), f));
      }
      return foldersByName;
    }

    const results = [];

    // Process each edit
    for (const edit of edits) {
      try {
        const itemType = edit.itemType || 'task';
        const itemId = edit.id || null;
        const itemName = edit.name || null;

        if (!itemId && !itemName) {
          results.push({
            success: false,
            error: "Either id or name must be provided"
          });
          continue;
        }

        // Find the item - use fast byIdentifier for ID lookups
        let foundItem = null;

        if (itemType === 'project') {
          if (itemId) foundItem = Project.byIdentifier(itemId);
          if (!foundItem && itemName) foundItem = getProjectsByName().get(itemName.toLowerCase());
        } else {
          if (itemId) foundItem = Task.byIdentifier(itemId);
          if (!foundItem && itemName) foundItem = getTasksByName().get(itemName.toLowerCase());
        }

        if (!foundItem) {
          results.push({
            success: false,
            id: itemId,
            name: itemName,
            error: "Item not found"
          });
          continue;
        }

        const changedProperties = [];
        const originalName = foundItem.name;
        const originalId = foundItem.id.primaryKey;

        // Apply changes (same logic as editTask.js)

        if (edit.newName !== undefined) {
          foundItem.name = edit.newName;
          changedProperties.push("name");
        }

        if (edit.newNote !== undefined) {
          foundItem.note = edit.newNote;
          changedProperties.push("note");
        }

        if (edit.newDueDate !== undefined) {
          if (edit.newDueDate === "" || edit.newDueDate === null) {
            foundItem.dueDate = null;
          } else {
            foundItem.dueDate = parseLocalDate(edit.newDueDate);
          }
          changedProperties.push("due date");
        }

        if (edit.newDeferDate !== undefined) {
          if (edit.newDeferDate === "" || edit.newDeferDate === null) {
            foundItem.deferDate = null;
          } else {
            foundItem.deferDate = parseLocalDate(edit.newDeferDate);
          }
          changedProperties.push("defer date");
        }

        if (edit.newPlannedDate !== undefined) {
          if (edit.newPlannedDate === "" || edit.newPlannedDate === null) {
            foundItem.plannedDate = null;
          } else {
            foundItem.plannedDate = parseLocalDate(edit.newPlannedDate);
          }
          changedProperties.push("planned date");
        }

        if (edit.newFlagged !== undefined) {
          foundItem.flagged = edit.newFlagged;
          changedProperties.push("flagged");
        }

        if (edit.newEstimatedMinutes !== undefined) {
          foundItem.estimatedMinutes = edit.newEstimatedMinutes;
          changedProperties.push("estimated minutes");
        }

        // Task-specific: Status changes
        if (itemType === 'task' && edit.newStatus !== undefined) {
          if (edit.newStatus === 'completed') {
            foundItem.markComplete();
            changedProperties.push("status (completed)");
          } else if (edit.newStatus === 'dropped') {
            const dropCompletely = edit.dropCompletely === true;
            foundItem.drop(dropCompletely);
            changedProperties.push(dropCompletely ? "status (dropped completely)" : "status (dropped)");
          } else if (edit.newStatus === 'incomplete') {
            foundItem.markIncomplete();
            changedProperties.push("status (incomplete)");
          }
        }

        // Task-specific: Move to inbox
        if (itemType === 'task' && edit.moveToInbox === true) {
          moveTasks([foundItem], inbox.ending);
          changedProperties.push("moved to inbox");
        }

        // Task-specific: Move to different project
        if (itemType === 'task' && edit.newProjectName) {
          const targetProject = getProjectsByName().get(edit.newProjectName.toLowerCase());
          if (targetProject) {
            moveTasks([foundItem], targetProject);
            changedProperties.push("moved to project");
          } else {
            results.push({
              success: false,
              id: originalId,
              name: originalName,
              error: `Project not found: ${edit.newProjectName}`
            });
            continue;
          }
        }

        // Task-specific: Move to parent task
        if (itemType === 'task' && (edit.newParentTaskId || edit.newParentTaskName)) {
          let targetParent = null;
          if (edit.newParentTaskId) {
            targetParent = Task.byIdentifier(edit.newParentTaskId);
          }
          if (!targetParent && edit.newParentTaskName) {
            targetParent = getTasksByName().get(edit.newParentTaskName.toLowerCase());
          }
          if (targetParent) {
            moveTasks([foundItem], targetParent);
            changedProperties.push("moved to parent task");
          } else {
            results.push({
              success: false,
              id: originalId,
              name: originalName,
              error: "Parent task not found"
            });
            continue;
          }
        }

        // Task-specific: Replace all tags
        if (itemType === 'task' && edit.replaceTags && edit.replaceTags.length > 0) {
          const existingTags = foundItem.tags.slice();
          for (const existingTag of existingTags) {
            foundItem.removeTag(existingTag);
          }
          for (const tagName of edit.replaceTags) {
            const tag = getTagsByName().get(tagName.toLowerCase());
            if (tag) foundItem.addTag(tag);
          }
          changedProperties.push("tags (replaced)");
        } else {
          if (itemType === 'task' && edit.addTags && edit.addTags.length > 0) {
            for (const tagName of edit.addTags) {
              const tag = getTagsByName().get(tagName.toLowerCase());
              if (tag) foundItem.addTag(tag);
            }
            changedProperties.push("tags (added)");
          }
          if (itemType === 'task' && edit.removeTags && edit.removeTags.length > 0) {
            for (const tagName of edit.removeTags) {
              const tag = getTagsByName().get(tagName.toLowerCase());
              if (tag) foundItem.removeTag(tag);
            }
            changedProperties.push("tags (removed)");
          }
        }

        // Task-specific: Repetition rule
        if (itemType === 'task' && edit.newRepetitionRule !== undefined) {
          if (edit.newRepetitionRule === null) {
            foundItem.repetitionRule = null;
            changedProperties.push("repetition (removed)");
          } else if (edit.newRepetitionRule && edit.newRepetitionRule.frequency) {
            try {
              const rruleString = buildRRule(edit.newRepetitionRule);
              const repeatFromCompletion = edit.newRepetitionRule.repeatFrom === 'completion';
              if (repeatFromCompletion) {
                foundItem.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DeferUntilDate);
              } else {
                foundItem.repetitionRule = new Task.RepetitionRule(rruleString, Task.RepetitionMethod.DueDate);
              }
              changedProperties.push("repetition");
            } catch (repError) {
              results.push({
                success: false,
                id: originalId,
                name: originalName,
                error: `Failed to set repetition rule: ${repError}`
              });
              continue;
            }
          }
        }

        // Project-specific: Sequential
        if (itemType === 'project' && edit.newSequential !== undefined) {
          foundItem.sequential = edit.newSequential;
          changedProperties.push("sequential");
        }

        // Project-specific: Status
        if (itemType === 'project' && edit.newProjectStatus !== undefined) {
          if (edit.newProjectStatus === 'active') {
            foundItem.status = Project.Status.Active;
          } else if (edit.newProjectStatus === 'completed') {
            foundItem.markComplete();
          } else if (edit.newProjectStatus === 'dropped') {
            foundItem.status = Project.Status.Dropped;
          } else if (edit.newProjectStatus === 'onHold') {
            foundItem.status = Project.Status.OnHold;
          }
          changedProperties.push("status");
        }

        // Project-specific: Move to folder
        if (itemType === 'project' && edit.newFolderName) {
          const targetFolder = getFoldersByName().get(edit.newFolderName.toLowerCase());
          if (targetFolder) {
            const currentFolder = foundItem.parentFolder;
            if (currentFolder && currentFolder.id.primaryKey === targetFolder.id.primaryKey) {
              changedProperties.push("already in folder");
            } else {
              moveSections([foundItem], targetFolder);
              changedProperties.push("moved to folder");
            }
          } else {
            const newFolder = new Folder(edit.newFolderName);
            moveSections([foundItem], newFolder);
            changedProperties.push("moved to new folder");
          }
        }

        // Project-specific: Mark as reviewed
        if (itemType === 'project' && edit.markReviewed === true) {
          if (typeof foundItem.markReviewed === 'function') {
            foundItem.markReviewed();
            changedProperties.push("marked as reviewed");
          }
        }

        results.push({
          success: true,
          id: originalId,
          name: originalName,
          changedProperties: changedProperties.join(", ")
        });

      } catch (itemError) {
        results.push({
          success: false,
          error: `Error processing item: ${itemError}`
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return JSON.stringify({
      success: successCount > 0,
      successCount: successCount,
      failureCount: failureCount,
      results: results
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error in batch edit: ${error}`
    });
  }
})();
