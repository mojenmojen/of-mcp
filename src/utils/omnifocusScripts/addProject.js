// OmniJS script to add a project
// This avoids AppleScript issues with ISO date parsing and special characters
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const projectName = args.name || null;
    const projectNote = args.note || null;
    const dueDate = args.dueDate || null;
    const deferDate = args.deferDate || null;
    const flagged = args.flagged || false;
    const estimatedMinutes = args.estimatedMinutes || null;
    const tagNames = args.tags || [];
    const folderName = args.folderName || null;
    const sequential = args.sequential || false;

    if (!projectName) {
      return JSON.stringify({
        success: false,
        error: "Project name is required"
      });
    }

    // Determine the container for the new project
    let container = null;

    if (folderName) {
      // Find folder by name
      const allFolders = flattenedFolders;
      for (const folder of allFolders) {
        if (folder.name === folderName) {
          container = folder;
          break;
        }
      }
      if (!container) {
        return JSON.stringify({
          success: false,
          error: `Folder not found: ${folderName}`
        });
      }
    }

    // Create the new project
    let newProject;
    if (container) {
      // Create in folder
      newProject = new Project(projectName, container);
    } else {
      // Create at root level
      newProject = new Project(projectName);
    }

    // Set project properties
    if (projectNote) {
      newProject.note = projectNote;
    }

    // Set due date - JavaScript's Date() correctly parses ISO format
    if (dueDate) {
      newProject.dueDate = new Date(dueDate);
    }

    // Set defer date
    if (deferDate) {
      newProject.deferDate = new Date(deferDate);
    }

    // Set flagged
    if (flagged) {
      newProject.flagged = true;
    }

    // Set estimated minutes
    if (estimatedMinutes) {
      newProject.estimatedMinutes = estimatedMinutes;
    }

    // Set sequential
    newProject.sequential = sequential;

    // Add tags
    if (tagNames && tagNames.length > 0) {
      const allTags = flattenedTags;
      for (const tagName of tagNames) {
        for (const tag of allTags) {
          if (tag.name === tagName) {
            newProject.addTag(tag);
            break;
          }
        }
      }
    }

    return JSON.stringify({
      success: true,
      projectId: newProject.id.primaryKey,
      name: newProject.name
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error adding project: ${error}`
    });
  }
})();
