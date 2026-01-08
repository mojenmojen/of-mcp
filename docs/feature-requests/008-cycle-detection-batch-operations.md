# 008: Cycle Detection in Batch Operations

## Priority: Medium
## Effort: Medium (2-3 hours)
## Category: Data Integrity Improvement

---

## Problem Statement

When using `batch_add_items` with hierarchical task creation (tasks with `parentTaskId` or `parentTaskName`), it's possible to create circular references:

```json
{
  "items": [
    { "name": "Task A", "tempId": "a", "parentTempId": "b" },
    { "name": "Task B", "tempId": "b", "parentTempId": "c" },
    { "name": "Task C", "tempId": "c", "parentTempId": "a" }
  ]
}
```

This would create: A → B → C → A (circular)

Currently, this either fails silently or creates corrupted data. There's no pre-validation or clear error message.

---

## Proposed Solution

Add cycle detection before processing batch items:
1. Build a dependency graph from parentTempId references
2. Use DFS to detect cycles before any items are created
3. Return clear error messages showing the cycle path
4. Only applies to batch operations with hierarchical references

---

## Files to Modify

### `src/tools/primitives/batchAddItems.ts`

Add cycle detection before calling OmniJS script:

```typescript
import { createValidationError } from '../../utils/errors.js';

interface BatchItem {
  name: string;
  tempId?: string;
  parentTempId?: string;
  // ... other fields
}

function detectCycles(items: BatchItem[]): string[] | null {
  // Only check items with tempId and parentTempId
  const itemsWithRefs = items.filter(i => i.tempId && i.parentTempId);
  if (itemsWithRefs.length === 0) return null;

  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(tempId: string, path: string[]): string[] | null {
    if (visited.has(tempId)) return null;

    if (visiting.has(tempId)) {
      // Found cycle - return the cycle path
      const cycleStart = path.indexOf(tempId);
      return [...path.slice(cycleStart), tempId];
    }

    visiting.add(tempId);
    path.push(tempId);

    const item = items.find(i => i.tempId === tempId);
    if (item?.parentTempId) {
      const cycle = dfs(item.parentTempId, path);
      if (cycle) return cycle;
    }

    path.pop();
    visiting.delete(tempId);
    visited.add(tempId);

    return null;
  }

  // Check from each item with a tempId
  for (const item of itemsWithRefs) {
    if (item.tempId && !visited.has(item.tempId)) {
      const cycle = dfs(item.tempId, []);
      if (cycle) return cycle;
    }
  }

  return null;
}

export async function batchAddItems(params: BatchAddItemsParams) {
  // Pre-validate for cycles
  const cycle = detectCycles(params.items);
  if (cycle) {
    const cycleNames = cycle.map(tempId => {
      const item = params.items.find(i => i.tempId === tempId);
      return item?.name || tempId;
    });

    return createValidationError(
      'Circular parent reference detected',
      `Cycle: ${cycleNames.join(' → ')}`
    );
  }

  // Proceed with batch operation
  const result = await executeOmniFocusScript('@batchAddItems.js', params);
  return result;
}
```

---

## Implementation Notes

- Only applies when using `tempId`/`parentTempId` for hierarchical creation
- Regular `parentTaskId` references (to existing tasks) can't create cycles within the batch
- Detection happens BEFORE any items are created
- Error message shows human-readable cycle path using task names
- DFS algorithm with O(n) complexity

---

## Test Cases

```typescript
// Test 1: Simple cycle (A → B → A)
const items1 = [
  { name: "Task A", tempId: "a", parentTempId: "b" },
  { name: "Task B", tempId: "b", parentTempId: "a" }
];
// Expected: Error "Circular parent reference: Task A → Task B → Task A"

// Test 2: Three-node cycle (A → B → C → A)
const items2 = [
  { name: "Task A", tempId: "a", parentTempId: "b" },
  { name: "Task B", tempId: "b", parentTempId: "c" },
  { name: "Task C", tempId: "c", parentTempId: "a" }
];
// Expected: Error showing cycle path

// Test 3: Self-reference (A → A)
const items3 = [
  { name: "Task A", tempId: "a", parentTempId: "a" }
];
// Expected: Error "Circular parent reference: Task A → Task A"

// Test 4: Valid hierarchy (no cycle)
const items4 = [
  { name: "Parent", tempId: "p" },
  { name: "Child 1", tempId: "c1", parentTempId: "p" },
  { name: "Child 2", tempId: "c2", parentTempId: "p" }
];
// Expected: Success - no cycle
```

---

## Acceptance Criteria

- [ ] Self-references detected (A → A)
- [ ] Two-node cycles detected (A → B → A)
- [ ] Multi-node cycles detected (A → B → C → A)
- [ ] Error message shows task names in cycle path
- [ ] Valid hierarchies still work
- [ ] Detection runs before any items created (no partial state)
- [ ] Version bump in package.json

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Cycle Detection in Batch Operations" section
