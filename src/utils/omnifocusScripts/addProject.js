// OmniJS script to add a project
// This avoids AppleScript issues with ISO date parsing and special characters
// Note: parseLocalDate, resolveFolderRef, formatAmbiguousFolderError and getFolderPath are provided by sharedUtils.js
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
    const folderId = args.folderId || null;
    const sequential = args.sequential || false;

    if (!projectName) {
      return JSON.stringify({
        success: false,
        error: "Project name is required"
      });
    }

    // Determine the container for the new project
    let container = null;

    if (folderId || folderName) {
      const allFolders = flattenedFolders;

      // Try ID lookup first
      if (folderId) {
        for (const folder of allFolders) {
          if (folder.id.primaryKey === folderId) {
            container = folder;
            break;
          }
        }
      }

      // Fall back to name lookup (supports "Parent > Child" paths)
      if (!container && folderName) {
        const ref = resolveFolderRef(folderName, allFolders);
        if (ref.ambiguous) {
          return JSON.stringify({
            success: false,
            error: formatAmbiguousFolderError(folderName, ref.matches, 'folderId')
          });
        }
        container = ref.folder;
      }

      if (!container) {
        const searchRef = folderId ? `ID "${folderId}"` : `name "${folderName}"`;
        return JSON.stringify({
          success: false,
          error: `Folder not found with ${searchRef}`
        });
      }
    }

    // Create the new project
    let newProject;
    if (container) {
      newProject = new Project(projectName, container);
    } else {
      newProject = new Project(projectName);
    }

    // Set project properties
    if (projectNote) {
      newProject.note = projectNote;
    }

    // Set due date - parseLocalDate handles date-only strings correctly
    if (dueDate) {
      newProject.dueDate = parseLocalDate(dueDate);
    }

    // Set defer date
    if (deferDate) {
      newProject.deferDate = parseLocalDate(deferDate);
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

    // Report where the project landed, read back from the created project
    // only, so the reply names where OmniFocus put it rather than what was
    // asked for (#151). The read has its own guard because the project
    // already exists: a throw reaching the outer catch would report
    // success:false, and a caller told the add failed retries it and
    // duplicates the project (#154). On a throw, location stays undefined
    // and the reply describes what was asked for.
    let location;
    try {
      const landedIn = newProject.parentFolder;
      if (landedIn) {
        // An unreadable parent chain still names the folder, by its own name
        let path;
        try {
          path = getFolderPath(landedIn);
        } catch (pathError) {
          path = landedIn.name;
        }
        location = { type: 'folder', path: path, id: landedIn.id.primaryKey };
      } else {
        location = { type: 'root' };
      }
    } catch (locationError) {
      console.log(`Warning: could not read the new project's location: ${locationError}`);
    }

    return JSON.stringify({
      success: true,
      projectId: newProject.id.primaryKey,
      name: newProject.name,
      location: location
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error adding project: ${error}`
    });
  }
})();
