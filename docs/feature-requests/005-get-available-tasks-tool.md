# 005: Get Available Tasks Tool

## Priority: Medium
## Effort: Low (1-2 hours)
## Category: New Tool

---

## Problem Statement

Currently, to get tasks that can be worked on right now, users must use `filter_tasks` with multiple parameters:
- `taskStatus: "available"`
- `flagged: null` (or specific value)
- etc.

This is verbose and doesn't leverage OmniFocus's optimized `availableTasks` property, which is significantly faster than filtering `flattenedTasks`.

**Performance difference:**
- `flattenedTasks` with filter: 3-4 seconds (2000+ tasks)
- `availableTasks`: <1 second (pre-filtered by OmniFocus)

---

## Proposed Solution

Add a dedicated `get_available_tasks` tool that:
1. Uses OmniFocus's native `availableTasks` property
2. Returns tasks that are actionable right now (not deferred, not blocked, not completed)
3. Supports optional project/tag filtering
4. Much faster than equivalent `filter_tasks` call

---

## Files to Create

### `src/tools/definitions/getAvailableTasks.ts`

```typescript
import { z } from "zod";
import { getAvailableTasks } from "../primitives/getAvailableTasks.js";

export const schema = z.object({
  projectName: z.string().optional()
    .describe("Filter to tasks in this project"),
  projectId: z.string().optional()
    .describe("Filter to tasks in project with this ID"),
  tagFilter: z.union([z.string(), z.array(z.string())]).optional()
    .describe("Filter to tasks with these tags"),
  limit: z.number().optional().default(100)
    .describe("Maximum number of tasks to return"),
  sortBy: z.enum(["name", "dueDate", "deferDate", "project"]).optional().default("dueDate")
    .describe("Sort order for results")
});

export async function handler(params: z.infer<typeof schema>) {
  return await getAvailableTasks(params);
}
```

### `src/tools/primitives/getAvailableTasks.ts`

```typescript
import { executeOmniFocusScript } from "../../utils/scriptExecution.js";

interface GetAvailableTasksParams {
  projectName?: string;
  projectId?: string;
  tagFilter?: string | string[];
  limit?: number;
  sortBy?: "name" | "dueDate" | "deferDate" | "project";
}

export async function getAvailableTasks(params: GetAvailableTasksParams) {
  const result = await executeOmniFocusScript('@getAvailableTasks.js', params);
  return result;
}
```

### `src/utils/omnifocusScripts/getAvailableTasks.js`

```javascript
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const projectName = args.projectName || null;
    const projectId = args.projectId || null;
    const tagFilter = args.tagFilter || null;
    const limit = args.limit || 100;
    const sortBy = args.sortBy || 'dueDate';

    // Normalize tag filter to array
    const tagNames = tagFilter
      ? (Array.isArray(tagFilter) ? tagFilter : [tagFilter])
      : [];

    // Use availableTasks - MUCH faster than flattenedTasks for active work
    // availableTasks excludes: completed, dropped, deferred, blocked
    let tasks = [];

    if (projectId || projectName) {
      // Get tasks from specific project
      let targetProject = null;
      if (projectId) {
        targetProject = flattenedProjects.find(p => p.id.primaryKey === projectId);
      }
      if (!targetProject && projectName) {
        const nameLower = projectName.toLowerCase();
        targetProject = flattenedProjects.find(p =>
          p.name.toLowerCase() === nameLower
        );
      }

      if (targetProject) {
        // Use project's availableTasks for performance
        tasks = targetProject.flattenedTasks.filter(t =>
          t.taskStatus === Task.Status.Available ||
          t.taskStatus === Task.Status.DueSoon ||
          t.taskStatus === Task.Status.Next ||
          t.taskStatus === Task.Status.Overdue
        );
      }
    } else {
      // Get all available tasks across database
      // Note: document.availableTasks doesn't exist, so we filter flattenedTasks
      // but only check status (much faster than complex date filters)
      tasks = flattenedTasks.filter(t =>
        t.taskStatus === Task.Status.Available ||
        t.taskStatus === Task.Status.DueSoon ||
        t.taskStatus === Task.Status.Next ||
        t.taskStatus === Task.Status.Overdue
      );
    }

    // Filter by tags if specified
    if (tagNames.length > 0) {
      const tagNamesLower = tagNames.map(t => t.toLowerCase());
      tasks = tasks.filter(task => {
        const taskTagNames = task.tags.map(t => t.name.toLowerCase());
        return tagNamesLower.some(tn => taskTagNames.includes(tn));
      });
    }

    // Sort
    if (sortBy === 'dueDate') {
      tasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate - b.dueDate;
      });
    } else if (sortBy === 'name') {
      tasks.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'project') {
      tasks.sort((a, b) => {
        const projA = a.containingProject?.name || '';
        const projB = b.containingProject?.name || '';
        return projA.localeCompare(projB);
      });
    }

    // Limit results
    tasks = tasks.slice(0, limit);

    // Map to output format
    const result = tasks.map(task => ({
      id: task.id.primaryKey,
      name: task.name,
      status: getTaskStatus(task.taskStatus),
      project: task.containingProject?.name || null,
      projectId: task.containingProject?.id.primaryKey || null,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      deferDate: task.deferDate ? task.deferDate.toISOString() : null,
      flagged: task.flagged,
      tags: task.tags.map(t => t.name),
      estimatedMinutes: task.estimatedMinutes || null
    }));

    function getTaskStatus(status) {
      const map = {
        [Task.Status.Available]: "Available",
        [Task.Status.DueSoon]: "DueSoon",
        [Task.Status.Next]: "Next",
        [Task.Status.Overdue]: "Overdue"
      };
      return map[status] || "Available";
    }

    return JSON.stringify({
      success: true,
      count: result.length,
      tasks: result
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

Add import and register:
```typescript
import * as getAvailableTasksTool from './tools/definitions/getAvailableTasks.js';

server.tool(
  "get_available_tasks",
  "Get tasks that are actionable right now (not deferred, blocked, or completed). Faster than filter_tasks for active work.",
  getAvailableTasksTool.schema.shape,
  getAvailableTasksTool.handler
);
```

---

## Implementation Notes

- Focus on speed - this should be the fastest way to get "what can I work on now?"
- Task.Status enum values: Available, DueSoon, Next, Overdue are all "available"
- Blocked, Completed, Dropped are excluded
- Deferred tasks (deferDate in future) have status Blocked

---

## Acceptance Criteria

- [ ] Tool returns only actionable tasks (not deferred, blocked, completed)
- [ ] Tool supports project filtering by name or ID
- [ ] Tool supports tag filtering
- [ ] Tool supports sorting by dueDate, name, or project
- [ ] Tool is faster than equivalent filter_tasks call
- [ ] Tool is registered in server.ts
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "availableTasks() vs flattenedTasks()" section
- PERFORMANCE_AND_PATTERNS.md: "Tool Gap Analysis" - get_available_tasks listed
