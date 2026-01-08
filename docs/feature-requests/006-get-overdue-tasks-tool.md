# 006: Get Overdue Tasks Tool

## Priority: Medium
## Effort: Low (1 hour)
## Category: New Tool

---

## Problem Statement

Getting overdue tasks currently requires using `filter_tasks` with `taskStatus: "overdue"`. While functional, a dedicated tool would be:
1. More discoverable for AI assistants
2. Faster (can use Task.Status.Overdue directly)
3. Provide richer output (e.g., days overdue)

---

## Proposed Solution

Add a dedicated `get_overdue_tasks` tool that:
1. Uses OmniFocus's native `Task.Status.Overdue` filter
2. Calculates days overdue for each task
3. Sorts by most overdue first (by default)
4. Supports project/tag filtering

---

## Files to Create

### `src/tools/definitions/getOverdueTasks.ts`

```typescript
import { z } from "zod";
import { getOverdueTasks } from "../primitives/getOverdueTasks.js";

export const schema = z.object({
  projectName: z.string().optional()
    .describe("Filter to tasks in this project"),
  projectId: z.string().optional()
    .describe("Filter to tasks in project with this ID"),
  tagFilter: z.union([z.string(), z.array(z.string())]).optional()
    .describe("Filter to tasks with these tags"),
  limit: z.number().optional().default(50)
    .describe("Maximum number of tasks to return"),
  sortBy: z.enum(["dueDate", "daysOverdue", "name", "project"]).optional().default("daysOverdue")
    .describe("Sort order (daysOverdue = most overdue first)")
});

export async function handler(params: z.infer<typeof schema>) {
  return await getOverdueTasks(params);
}
```

### `src/tools/primitives/getOverdueTasks.ts`

```typescript
import { executeOmniFocusScript } from "../../utils/scriptExecution.js";

interface GetOverdueTasksParams {
  projectName?: string;
  projectId?: string;
  tagFilter?: string | string[];
  limit?: number;
  sortBy?: "dueDate" | "daysOverdue" | "name" | "project";
}

export async function getOverdueTasks(params: GetOverdueTasksParams) {
  const result = await executeOmniFocusScript('@getOverdueTasks.js', params);
  return result;
}
```

### `src/utils/omnifocusScripts/getOverdueTasks.js`

```javascript
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const projectName = args.projectName || null;
    const projectId = args.projectId || null;
    const tagFilter = args.tagFilter || null;
    const limit = args.limit || 50;
    const sortBy = args.sortBy || 'daysOverdue';

    const tagNames = tagFilter
      ? (Array.isArray(tagFilter) ? tagFilter : [tagFilter])
      : [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Get overdue tasks - use status filter for speed
    let tasks = flattenedTasks.filter(t =>
      t.taskStatus === Task.Status.Overdue
    );

    // Filter by project if specified
    if (projectId || projectName) {
      let targetProjectId = projectId;
      if (!targetProjectId && projectName) {
        const nameLower = projectName.toLowerCase();
        const proj = flattenedProjects.find(p =>
          p.name.toLowerCase() === nameLower
        );
        if (proj) targetProjectId = proj.id.primaryKey;
      }

      if (targetProjectId) {
        tasks = tasks.filter(t =>
          t.containingProject?.id.primaryKey === targetProjectId
        );
      }
    }

    // Filter by tags if specified
    if (tagNames.length > 0) {
      const tagNamesLower = tagNames.map(t => t.toLowerCase());
      tasks = tasks.filter(task => {
        const taskTagNames = task.tags.map(t => t.name.toLowerCase());
        return tagNamesLower.some(tn => taskTagNames.includes(tn));
      });
    }

    // Calculate days overdue and map to output
    let result = tasks.map(task => {
      const dueDate = task.dueDate;
      const daysOverdue = dueDate
        ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: task.id.primaryKey,
        name: task.name,
        project: task.containingProject?.name || null,
        projectId: task.containingProject?.id.primaryKey || null,
        dueDate: dueDate ? dueDate.toISOString() : null,
        daysOverdue: daysOverdue,
        flagged: task.flagged,
        tags: task.tags.map(t => t.name),
        estimatedMinutes: task.estimatedMinutes || null,
        note: task.note ? task.note.substring(0, 200) : null
      };
    });

    // Sort
    if (sortBy === 'daysOverdue') {
      result.sort((a, b) => b.daysOverdue - a.daysOverdue);
    } else if (sortBy === 'dueDate') {
      result.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'project') {
      result.sort((a, b) => {
        const projA = a.project || '';
        const projB = b.project || '';
        return projA.localeCompare(projB);
      });
    }

    // Limit
    result = result.slice(0, limit);

    return JSON.stringify({
      success: true,
      count: result.length,
      totalOverdue: tasks.length,
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

```typescript
import * as getOverdueTasksTool from './tools/definitions/getOverdueTasks.js';

server.tool(
  "get_overdue_tasks",
  "Get tasks that are past their due date, sorted by how overdue they are",
  getOverdueTasksTool.schema.shape,
  getOverdueTasksTool.handler
);
```

---

## Implementation Notes

- `daysOverdue` is calculated server-side for convenience
- Default sort by most overdue first (prioritize oldest debt)
- Includes truncated note (first 200 chars) for context
- `totalOverdue` in response shows total count before limit

---

## Acceptance Criteria

- [ ] Tool returns only overdue tasks
- [ ] Each task includes `daysOverdue` calculation
- [ ] Default sort is by days overdue (most first)
- [ ] Tool supports project filtering
- [ ] Tool supports tag filtering
- [ ] Tool is registered in server.ts
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Tool Gap Analysis" - get_overdue_tasks listed
- PERFORMANCE_AND_PATTERNS.md: "Task.Status Enum Constants" section
