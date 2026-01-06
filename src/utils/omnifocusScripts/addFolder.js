// OmniJS script to add a folder
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const folderName = args.name || null;
    const parentFolderName = args.parentFolderName || null;
    const parentFolderId = args.parentFolderId || null;

    if (!folderName) {
      return JSON.stringify({
        success: false,
        error: "Folder name is required"
      });
    }

    // Find parent folder if specified
    let parentFolder = null;

    if (parentFolderId || parentFolderName) {
      const allFolders = flattenedFolders;

      // Priority: ID first, then name
      if (parentFolderId) {
        for (const folder of allFolders) {
          if (folder.id.primaryKey === parentFolderId) {
            parentFolder = folder;
            break;
          }
        }
        if (!parentFolder) {
          return JSON.stringify({
            success: false,
            error: `Parent folder not found with ID: ${parentFolderId}`
          });
        }
      } else if (parentFolderName) {
        for (const folder of allFolders) {
          if (folder.name === parentFolderName) {
            parentFolder = folder;
            break;
          }
        }
        if (!parentFolder) {
          return JSON.stringify({
            success: false,
            error: `Parent folder not found: ${parentFolderName}`
          });
        }
      }
    }

    // Create the new folder
    let newFolder;
    if (parentFolder) {
      // Create nested folder
      newFolder = new Folder(folderName, parentFolder);
    } else {
      // Create at root level
      newFolder = new Folder(folderName);
    }

    return JSON.stringify({
      success: true,
      folderId: newFolder.id.primaryKey,
      name: newFolder.name,
      parentFolderName: parentFolder ? parentFolder.name : null
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error adding folder: ${error}`
    });
  }
})();
