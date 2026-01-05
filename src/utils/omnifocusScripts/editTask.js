// OmniJS script to edit a task
// This avoids AppleScript escaping issues with special characters like $
(() => {
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

    // Get all items based on type
    let allItems;
    if (itemType === 'project') {
      allItems = flattenedProjects;
    } else {
      allItems = flattenedTasks;
    }

    // Find the item
    let foundItem = null;

    // Search by ID first
    if (taskId) {
      for (const item of allItems) {
        if (item.id.primaryKey === taskId) {
          foundItem = item;
          break;
        }
      }
    }

    // If not found by ID, search by name (case-insensitive)
    if (!foundItem && taskName) {
      const taskNameLower = taskName.toLowerCase();
      for (const item of allItems) {
        if (item.name.toLowerCase() === taskNameLower) {
          foundItem = item;
          break;
        }
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

    // Task-specific: Move to different project (case-insensitive)
    if (itemType === 'task' && args.newProjectName) {
      const allProjects = flattenedProjects;
      const newProjectNameLower = args.newProjectName.toLowerCase();
      let targetProject = null;
      for (const proj of allProjects) {
        if (proj.name.toLowerCase() === newProjectNameLower) {
          targetProject = proj;
          break;
        }
      }
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

    // Task-specific: Move to parent task (case-insensitive for name)
    if (itemType === 'task' && (args.newParentTaskId || args.newParentTaskName)) {
      const allTasks = flattenedTasks;
      let targetParent = null;

      if (args.newParentTaskId) {
        for (const t of allTasks) {
          if (t.id.primaryKey === args.newParentTaskId) {
            targetParent = t;
            break;
          }
        }
      }

      if (!targetParent && args.newParentTaskName) {
        const newParentTaskNameLower = args.newParentTaskName.toLowerCase();
        for (const t of allTasks) {
          if (t.name.toLowerCase() === newParentTaskNameLower) {
            targetParent = t;
            break;
          }
        }
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

    // Task-specific: Replace all tags (case-insensitive)
    if (itemType === 'task' && args.replaceTags && args.replaceTags.length > 0) {
      const allTags = flattenedTags;
      // First, remove all existing tags
      const existingTags = foundItem.tags.slice(); // Make a copy
      for (const existingTag of existingTags) {
        foundItem.removeTag(existingTag);
      }
      // Then add new tags
      for (const tagName of args.replaceTags) {
        const tagNameLower = tagName.toLowerCase();
        let tag = null;
        for (const t of allTags) {
          if (t.name.toLowerCase() === tagNameLower) {
            tag = t;
            break;
          }
        }
        if (tag) {
          foundItem.addTag(tag);
        }
      }
      changedProperties.push("tags (replaced)");
    } else {
      // Task-specific: Add tags (case-insensitive)
      if (itemType === 'task' && args.addTags && args.addTags.length > 0) {
        const allTags = flattenedTags;
        for (const tagName of args.addTags) {
          const tagNameLower = tagName.toLowerCase();
          let tag = null;
          for (const t of allTags) {
            if (t.name.toLowerCase() === tagNameLower) {
              tag = t;
              break;
            }
          }
          if (tag) {
            foundItem.addTag(tag);
          }
        }
        changedProperties.push("tags (added)");
      }

      // Task-specific: Remove tags (case-insensitive)
      if (itemType === 'task' && args.removeTags && args.removeTags.length > 0) {
        const allTags = flattenedTags;
        for (const tagName of args.removeTags) {
          const tagNameLower = tagName.toLowerCase();
          let tag = null;
          for (const t of allTags) {
            if (t.name.toLowerCase() === tagNameLower) {
              tag = t;
              break;
            }
          }
          if (tag) {
            foundItem.removeTag(tag);
          }
        }
        changedProperties.push("tags (removed)");
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

    // Project-specific: Move to folder (case-insensitive)
    if (itemType === 'project' && args.newFolderName) {
      const allFolders = flattenedFolders;
      const newFolderNameLower = args.newFolderName.toLowerCase();
      let targetFolder = null;
      for (const folder of allFolders) {
        if (folder.name.toLowerCase() === newFolderNameLower) {
          targetFolder = folder;
          break;
        }
      }
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
