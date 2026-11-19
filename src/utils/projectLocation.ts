// Where a newly created project landed, as reported by addProject.js, and the
// wording add_project uses for it (#151). Pure, so it is unit-tested.

export type ProjectLocation =
  | { type: 'root' }
  | { type: 'folder'; path: string; id: string };

export interface ProjectLocationArgs {
  folderName?: string;
  folderId?: string;
}

export function describeProjectLocation(location: ProjectLocation | undefined, args: ProjectLocationArgs): string {
  if (location) {
    switch (location.type) {
      case 'folder':
        return `in folder "${location.path}" (id: ${location.id})`;
      case 'root':
        return 'at the root level';
    }
  }

  // The script didn't say where the project went, so describe what was asked
  // for, never defaulting to the root when a folder was named.
  if (args.folderName) {
    return `in folder "${args.folderName}"`;
  }
  if (args.folderId) {
    return `in folder with id ${args.folderId}`;
  }
  return 'at the root level';
}
