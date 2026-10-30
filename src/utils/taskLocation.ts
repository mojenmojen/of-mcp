// Where a newly created task landed, as reported by addTask.js, and the
// wording add_omnifocus_task uses for it (#157). Pure, so it is unit-tested.

export type TaskLocation =
  | { type: 'inbox' }
  | { type: 'project'; name: string; id: string }
  | { type: 'parentTask'; name: string; id: string };

export interface TaskLocationArgs {
  projectName?: string;
  projectId?: string;
  parentTaskName?: string;
  parentTaskId?: string;
}

export function describeTaskLocation(location: TaskLocation | undefined, args: TaskLocationArgs): string {
  if (location) {
    switch (location.type) {
      case 'parentTask':
        return `as a subtask of "${location.name}" (id: ${location.id})`;
      case 'project':
        return `in project "${location.name}" (id: ${location.id})`;
      case 'inbox':
        return 'in your inbox';
    }
  }

  // The script didn't say where the task went, so describe what was asked
  // for, never defaulting to the inbox when a project or parent was named.
  const parentRef = args.parentTaskId || args.parentTaskName;
  if (parentRef) {
    return `as a subtask of "${parentRef}"`;
  }
  if (args.projectName) {
    return `in project "${args.projectName}"`;
  }
  if (args.projectId) {
    return `in project with id ${args.projectId}`;
  }
  return 'in your inbox';
}
