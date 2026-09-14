// OmniJS script to find a folder by ID or name
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};
    const folderId = args.folderId || null;
    const folderName = args.folderName || null;

    // Track optional-field read failures instead of swallowing them silently (issue #110)
    const MAX_ERROR_SAMPLES = 3;
    let metadataErrorCount = 0;
    const errorSamples = [];

    if (!folderId && !folderName) {
      return JSON.stringify({
        success: false,
        error: "Either folderId or folderName must be provided"
      });
    }

    // Get all flattened folders
    const allFolders = flattenedFolders;
    let foundFolder = null;

    // Search by ID first (most reliable)
    if (folderId) {
      for (const folder of allFolders) {
        if (folder.id.primaryKey === folderId) {
          foundFolder = folder;
          break;
        }
      }
    }

    // If not found by ID, search by name (supports "Parent > Child" paths)
    if (!foundFolder && folderName) {
      const ref = resolveFolderRef(folderName, allFolders);
      if (ref.ambiguous) {
        return JSON.stringify({
          success: false,
          error: formatAmbiguousFolderError(folderName, ref.matches, 'folderId')
        });
      }
      foundFolder = ref.folder;
    }

    if (!foundFolder) {
      return JSON.stringify({
        success: false,
        error: "Folder not found"
      });
    }

    // Get folder status string
    const statusMap = {
      [Folder.Status.Active]: "Active",
      [Folder.Status.Dropped]: "Dropped"
    };

    // Build folder info
    const folderInfo = {
      id: foundFolder.id.primaryKey,
      name: foundFolder.name,
      status: statusMap[foundFolder.status] || "Unknown",
      projectCount: 0,
      activeProjectCount: 0,
      subfolderCount: 0,
      parentFolderId: null,
      parentFolderName: null
    };

    // Get project counts
    try {
      if (foundFolder.projects) {
        folderInfo.projectCount = foundFolder.projects.length;
        folderInfo.activeProjectCount = foundFolder.projects.filter(
          p => p.status === Project.Status.Active
        ).length;
      }
    } catch (e) {
      metadataErrorCount++;
      if (errorSamples.length < MAX_ERROR_SAMPLES) {
        errorSamples.push(`projectCount(${foundFolder.name || 'unknown'}): ${e.message || String(e)}`);
      }
    }

    // Get subfolder count
    try {
      if (foundFolder.folders) {
        folderInfo.subfolderCount = foundFolder.folders.length;
      }
    } catch (e) {
      metadataErrorCount++;
      if (errorSamples.length < MAX_ERROR_SAMPLES) {
        errorSamples.push(`subfolderCount(${foundFolder.name || 'unknown'}): ${e.message || String(e)}`);
      }
    }

    // Get parent folder info (Folder.parent is itself a Folder, or null for top-level folders)
    try {
      if (foundFolder.parent) {
        folderInfo.parentFolderId = foundFolder.parent.id.primaryKey;
        folderInfo.parentFolderName = foundFolder.parent.name;
      }
    } catch (e) {
      metadataErrorCount++;
      if (errorSamples.length < MAX_ERROR_SAMPLES) {
        errorSamples.push(`parentFolder(${foundFolder.name || 'unknown'}): ${e.message || String(e)}`);
      }
    }

    try {
      folderInfo.path = getFolderPath(foundFolder);
    } catch (e) {
      folderInfo.path = foundFolder.name;
    }

    const result = {
      success: true,
      folder: folderInfo
    };
    if (metadataErrorCount > 0) {
      result.processingErrors = { metadataErrors: metadataErrorCount, samples: errorSamples };
    }
    return JSON.stringify(result);

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: `Error finding folder: ${error}`
    });
  }
})();
