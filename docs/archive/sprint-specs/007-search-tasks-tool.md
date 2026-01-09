# 007: Search Tasks Tool

## Priority: Medium
## Effort: Low (1-2 hours)
## Category: New Tool

---

## Problem Statement

While `filter_tasks` supports `searchText` parameter, it's not the most intuitive interface for simple text searches. Users often want to just "find tasks containing X" without configuring multiple filter parameters.

A dedicated search tool would be:
1. More discoverable - clear intent from the tool name
2. Simpler API - just a search query
3. Search across name AND notes by default
4. Support for common search patterns (exact match, any word, all words)

---

## Proposed Solution

Add a `search_tasks` tool optimized for text search across task names and notes.

---

## Files to Create

### `src/tools/definitions/searchTasks.ts`

```typescript
import { z } from "zod";
import { searchTasks } from "../primitives/searchTasks.js";

export const schema = z.object({
  query: z.string().min(1)
    .describe("Search query - matches task names and notes"),
  matchMode: z.enum(["contains", "anyWord", "allWords", "exact"]).optional().default("contains")
    .describe("How to match: 'contains' (default), 'anyWord', 'allWords', or 'exact'"),
  searchIn: z.enum(["all", "name", "note"]).optional().default("all")
    .describe("Where to search: 'all' (default), 'name' only, or 'note' only"),
  includeCompleted: z.boolean().optional().default(false)
    .describe("Include completed tasks in results"),
  projectName: z.string().optional()
    .describe("Limit search to this project"),
  projectId: z.string().optional()
    .describe("Limit search to project with this ID"),
  limit: z.number().optional().default(50)
    .describe("Maximum results to return")
});

export async function handler(params: z.infer<typeof schema>) {
  return await searchTasks(params);
}
```

### `src/tools/primitives/searchTasks.ts`

```typescript
import { executeOmniFocusScript } from "../../utils/scriptExecution.js";

interface SearchTasksParams {
  query: string;
  matchMode?: "contains" | "anyWord" | "allWords" | "exact";
  searchIn?: "all" | "name" | "note";
  includeCompleted?: boolean;
  projectName?: string;
  projectId?: string;
  limit?: number;
}

export async function searchTasks(params: SearchTasksParams) {
  const result = await executeOmniFocusScript('@searchTasks.js', params);
  return result;
}
```

### `src/utils/omnifocusScripts/searchTasks.js`

```javascript
(() => {
  try {
    const args = typeof injectedArgs !== 'undefined' ? injectedArgs : {};

    const query = args.query || '';
    const matchMode = args.matchMode || 'contains';
    const searchIn = args.searchIn || 'all';
    const includeCompleted = args.includeCompleted || false;
    const projectName = args.projectName || null;
    const projectId = args.projectId || null;
    const limit = args.limit || 50;

    if (!query) {
      return JSON.stringify({
        success: false,
        error: "Search query is required"
      });
    }

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);

    // Build match function based on mode
    function matches(text) {
      if (!text) return false;
      const textLower = text.toLowerCase();

      switch (matchMode) {
        case 'exact':
          return textLower === queryLower;
        case 'anyWord':
          return queryWords.some(word => textLower.includes(word));
        case 'allWords':
          return queryWords.every(word => textLower.includes(word));
        case 'contains':
        default:
          return textLower.includes(queryLower);
      }
    }

    // Get tasks to search
    let tasks = flattenedTasks;

    // Filter by completion status
    if (!includeCompleted) {
      tasks = tasks.filter(t =>
        t.taskStatus !== Task.Status.Completed &&
        t.taskStatus !== Task.Status.Dropped
      );
    }

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

    // Search
    const matchedTasks = tasks.filter(task => {
      const nameMatch = searchIn !== 'note' && matches(task.name);
      const noteMatch = searchIn !== 'name' && matches(task.note);
      return nameMatch || noteMatch;
    });

    // Map to output format with match highlights
    let result = matchedTasks.slice(0, limit).map(task => {
      const nameMatch = matches(task.name);
      const noteMatch = matches(task.note);

      return {
        id: task.id.primaryKey,
        name: task.name,
        matchedIn: nameMatch && noteMatch ? 'both' : (nameMatch ? 'name' : 'note'),
        project: task.containingProject?.name || null,
        projectId: task.containingProject?.id.primaryKey || null,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        completed: task.taskStatus === Task.Status.Completed,
        flagged: task.flagged,
        tags: task.tags.map(t => t.name),
        notePreview: task.note ? task.note.substring(0, 150) : null
      };
    });

    return JSON.stringify({
      success: true,
      query: query,
      matchMode: matchMode,
      totalMatches: matchedTasks.length,
      returned: result.length,
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
import * as searchTasksTool from './tools/definitions/searchTasks.js';

server.tool(
  "search_tasks",
  "Full-text search across task names and notes. Simpler than filter_tasks for finding tasks by text.",
  searchTasksTool.schema.shape,
  searchTasksTool.handler
);
```

---

## Implementation Notes

- Case-insensitive search by default
- Match modes provide flexibility:
  - `contains`: "review report" matches "Review the quarterly report"
  - `anyWord`: "meeting budget" matches tasks with either word
  - `allWords`: "meeting budget" only matches tasks with both words
  - `exact`: Exact string match (rarely used)
- `matchedIn` field helps users understand where match occurred
- Note preview truncated to 150 chars for brevity

---

## Acceptance Criteria

- [ ] Tool searches both name and notes by default
- [ ] Tool supports matchMode: contains, anyWord, allWords, exact
- [ ] Tool supports searchIn: all, name, note
- [ ] Tool excludes completed tasks by default
- [ ] Tool supports project filtering
- [ ] Response includes which field matched (name, note, both)
- [ ] Tool is registered in server.ts
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Tool Gap Analysis" - search_tasks listed as high value
