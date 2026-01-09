# 010: Duplicate Project Tool

## Priority: Low
## Effort: Medium (3-4 hours)
## Category: New Tool

---

## Problem Statement

OmniFocus users often use projects as templates:
- Weekly review checklists
- Sprint planning templates
- Event planning workflows
- Onboarding processes

Currently, duplicating a project requires:
1. Manually listing all tasks in the project
2. Creating a new project
3. Batch-adding all tasks with the same structure

A dedicated tool would make template-based workflows much easier.

---

## Proposed Solution

Add a `duplicate_project` tool that:
1. Copies a project with all its tasks
2. Preserves task hierarchy (subtasks)
3. Optionally resets dates (relative to new start date)
4. Optionally clears completion status
5. Allows specifying new name and folder

---

## Files to Create

### `src/tools/definitions/duplicateProject.ts`

```typescript
import { z } from "zod";
import { duplicateProject } from "../primitives/duplicateProject.js";

export const schema = z.object({
  sourceProjectId: z.string().optional()
    .describe("ID of project to duplicate"),
  sourceProjectName: z.string().optional()
    .describe("Name of project to duplicate (if ID not provided)"),
  newName: z.string()
    .describe("Name for the duplicated project"),
  folderName: z.string().optional()
    .describe("Folder to place the new project in"),
  folderId: z.string().optional()
    .describe("Folder ID to place the new project in"),
  resetDates: z.boolean().optional().default(true)
    .describe("Clear all dates (defer, due) from duplicated tasks"),
  shiftDates: z.object({
    referenceDate: z.string().describe("New start date (ISO format)"),
    basedOn: z.enum(["defer", "due"]).default("defer")
      .describe("Which date to use as reference for shifting")
  }).optional()
    .describe("Shift all dates relative to a new start date"),
  clearCompleted: z.boolean().optional().default(true)
    .describe("Reset all tasks to incomplete status"),
  copyNotes: z.boolean().optional().default(true)
    .describe("Copy task notes"),
  copyTags: z.boolean().optional().default(true)
    .describe("Copy task tags")
}).refine(
  data => data.sourceProjectId || data.sourceProjectName,
  { message: "Either sourceProjectId or sourceProjectName is required" }
);

export async function handler(params: z.infer<typeof schema>) {
  return await duplicateProject(params);
}
```

### `src/tools/primitives/duplicateProject.ts`

```typescript
import { executeOmniFocusScript } from "../../utils/scriptExecution.js";

export async function duplicateProject(params: any) {
  const result = await executeOmniFocusScript('@duplicateProject.js', params);
  return result;
}
```

### `src/utils/omnifocusScripts/duplicateProject.js`

```javascript
// Note: parseLocalDate is provided by sharedUtils.js
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const sourceProjectId = args.sourceProjectId || null;
    const sourceProjectName = args.sourceProjectName || null;
    const newName = args.newName;
    const folderName = args.folderName || null;
    const folderId = args.folderId || null;
    const resetDates = args.resetDates !== false;
    const shiftDates = args.shiftDates || null;
    const clearCompleted = args.clearCompleted !== false;
    const copyNotes = args.copyNotes !== false;
    const copyTags = args.copyTags !== false;

    // Find source project
    let sourceProject = null;
    if (sourceProjectId) {
      sourceProject = flattenedProjects.find(p => p.id.primaryKey === sourceProjectId);
    }
    if (!sourceProject && sourceProjectName) {
      const nameLower = sourceProjectName.toLowerCase();
      sourceProject = flattenedProjects.find(p => p.name.toLowerCase() === nameLower);
    }

    if (!sourceProject) {
      return JSON.stringify({
        success: false,
        error: `Source project not found: ${sourceProjectId || sourceProjectName}`
      });
    }

    // Find or create target folder
    let targetFolder = null;
    if (folderId) {
      targetFolder = flattenedFolders.find(f => f.id.primaryKey === folderId);
    }
    if (!targetFolder && folderName) {
      const nameLower = folderName.toLowerCase();
      targetFolder = flattenedFolders.find(f => f.name.toLowerCase() === nameLower);
      if (!targetFolder) {
        targetFolder = new Folder(folderName);
      }
    }

    // Calculate date shift if specified
    let dateShiftMs = 0;
    if (shiftDates) {
      const newStartDate = parseLocalDate(shiftDates.referenceDate);
      const basedOn = shiftDates.basedOn || 'defer';

      // Find earliest date in source project
      let earliestDate = null;
      sourceProject.flattenedTasks.forEach(task => {
        const dateToCheck = basedOn === 'defer' ? task.deferDate : task.dueDate;
        if (dateToCheck && (!earliestDate || dateToCheck < earliestDate)) {
          earliestDate = dateToCheck;
        }
      });

      if (earliestDate) {
        dateShiftMs = newStartDate.getTime() - earliestDate.getTime();
      }
    }

    // Create new project
    const newProject = targetFolder
      ? new Project(newName, targetFolder)
      : new Project(newName);

    // Copy project properties
    if (copyNotes && sourceProject.note) {
      newProject.note = sourceProject.note;
    }
    newProject.sequential = sourceProject.sequential;

    // Build task tree for recursive copy
    function getTaskTree(tasks, parentId = null) {
      const result = [];
      tasks.forEach(task => {
        const taskParentId = task.parent?.id.primaryKey || null;
        if (taskParentId === parentId) {
          result.push({
            task: task,
            children: getTaskTree(tasks, task.id.primaryKey)
          });
        }
      });
      return result;
    }

    const sourceTasks = sourceProject.flattenedTasks.slice();
    const taskTree = getTaskTree(sourceTasks, sourceProject.rootTask?.id.primaryKey);

    // Recursive function to copy tasks
    function copyTasks(nodes, container) {
      nodes.forEach(node => {
        const sourceTask = node.task;

        // Create new task
        const newTask = new Task(sourceTask.name, container);

        // Copy properties
        if (copyNotes && sourceTask.note) {
          newTask.note = sourceTask.note;
        }

        newTask.flagged = sourceTask.flagged;
        newTask.estimatedMinutes = sourceTask.estimatedMinutes;

        // Handle dates
        if (!resetDates) {
          if (shiftDates && dateShiftMs !== 0) {
            // Shift dates
            if (sourceTask.deferDate) {
              newTask.deferDate = new Date(sourceTask.deferDate.getTime() + dateShiftMs);
            }
            if (sourceTask.dueDate) {
              newTask.dueDate = new Date(sourceTask.dueDate.getTime() + dateShiftMs);
            }
          } else {
            // Copy dates as-is
            newTask.deferDate = sourceTask.deferDate;
            newTask.dueDate = sourceTask.dueDate;
          }
        }
        // If resetDates is true, leave dates null (default)

        // Copy tags
        if (copyTags) {
          sourceTask.tags.forEach(tag => {
            newTask.addTag(tag);
          });
        }

        // Clear completion if requested
        if (!clearCompleted && sourceTask.completed) {
          newTask.markComplete();
        }

        // Recursively copy children
        if (node.children.length > 0) {
          copyTasks(node.children, newTask);
        }
      });
    }

    copyTasks(taskTree, newProject);

    return JSON.stringify({
      success: true,
      newProjectId: newProject.id.primaryKey,
      newProjectName: newProject.name,
      tasksCopied: sourceTasks.length,
      sourceProject: sourceProject.name
    });

  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
})()
```

---

## Files to Modify

### `src/server.ts`

```typescript
import * as duplicateProjectTool from './tools/definitions/duplicateProject.js';

server.tool(
  "duplicate_project",
  "Create a copy of a project including all its tasks. Useful for templates.",
  duplicateProjectTool.schema.shape,
  duplicateProjectTool.handler
);
```

---

## Implementation Notes

- Task hierarchy preserved via recursive copy
- Tags are referenced (not copied) - same tag objects
- Date shifting calculates offset from earliest date
- New tasks are always created at end of container
- Consider adding repetition rule copying in future

---

## Acceptance Criteria

- [ ] Tool copies project with all tasks
- [ ] Task hierarchy (subtasks) preserved
- [ ] resetDates clears all dates when true
- [ ] shiftDates shifts dates relative to new start
- [ ] clearCompleted resets completion status
- [ ] copyNotes and copyTags options work
- [ ] New project placed in specified folder
- [ ] Tool is registered in server.ts
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Tool Gap Analysis" - duplicate_project listed as medium value
