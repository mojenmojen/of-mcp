# 009: Checksum-Based Cache Invalidation

## Priority: Low
## Effort: High (4-6 hours)
## Category: Performance Optimization

---

## Problem Statement

Every tool call executes a fresh OmniJS script, even when the underlying data hasn't changed. For repeated queries (e.g., AI reviewing the same project multiple times), this is wasteful.

Common scenario:
1. User asks "What tasks are in Project X?"
2. AI calls `filter_tasks` → 3-4 seconds
3. User asks "Tell me more about the first task"
4. AI calls `get_task_by_id` → 2-3 seconds
5. User asks "What were those tasks again?"
6. AI calls `filter_tasks` again → 3-4 seconds (same data!)

With caching, step 6 would be instant.

---

## Proposed Solution

Implement a lightweight cache with checksum-based invalidation:
1. Generate a "database checksum" from task/project counts and latest modification time
2. Cache query results with the checksum
3. Before serving cached result, verify checksum still matches
4. Invalidate cache on write operations

---

## Files to Create

### `src/utils/cache.ts`

```typescript
interface CacheEntry<T> {
  checksum: string;
  timestamp: number;
  data: T;
}

interface CacheConfig {
  maxAge: number;  // Max age in ms (even if checksum matches)
  maxEntries: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxAge: 60000,  // 1 minute max (even with valid checksum)
  maxEntries: 100
};

class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private lastChecksum: string | null = null;
  private checksumFetchTime: number = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private generateKey(operation: string, params: any): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  async getChecksum(): Promise<string> {
    // Only fetch checksum every 5 seconds at most
    const now = Date.now();
    if (this.lastChecksum && now - this.checksumFetchTime < 5000) {
      return this.lastChecksum;
    }

    // Fetch fresh checksum from OmniFocus
    const result = await executeOmniFocusScript('@getChecksum.js');
    this.lastChecksum = result.checksum;
    this.checksumFetchTime = now;
    return this.lastChecksum;
  }

  async get<T>(operation: string, params: any): Promise<T | null> {
    const key = this.generateKey(operation, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check max age
    if (Date.now() - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Verify checksum
    const currentChecksum = await this.getChecksum();
    if (entry.checksum !== currentChecksum) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  async set<T>(operation: string, params: any, data: T): Promise<void> {
    const key = this.generateKey(operation, params);
    const checksum = await this.getChecksum();

    // Enforce max entries (LRU-style: delete oldest)
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      checksum,
      timestamp: Date.now(),
      data
    });
  }

  invalidate(): void {
    this.cache.clear();
    this.lastChecksum = null;
  }

  // Invalidate on write operations
  invalidateOnWrite(): void {
    this.invalidate();
  }
}

export const queryCache = new QueryCache();
```

### `src/utils/omnifocusScripts/getChecksum.js`

```javascript
(() => {
  try {
    const taskCount = flattenedTasks.length;
    const projectCount = flattenedProjects.length;
    const tagCount = flattenedTags.length;

    // Find latest modification time
    let latestMod = new Date(0);
    flattenedTasks.forEach(task => {
      const mod = task.modificationDate;
      if (mod && mod > latestMod) {
        latestMod = mod;
      }
    });

    const checksum = `${taskCount}-${projectCount}-${tagCount}-${latestMod.getTime()}`;

    return JSON.stringify({
      checksum: checksum,
      taskCount: taskCount,
      projectCount: projectCount,
      tagCount: tagCount,
      latestModification: latestMod.toISOString()
    });
  } catch (error) {
    return JSON.stringify({ error: error.message });
  }
})()
```

---

## Files to Modify

### Read-only tool primitives (example: filterTasks.ts)

```typescript
import { queryCache } from '../../utils/cache.js';

export async function filterTasks(params: FilterTasksParams) {
  // Check cache first
  const cached = await queryCache.get('filterTasks', params);
  if (cached) {
    return cached;
  }

  // Execute query
  const result = await executeOmniFocusScript('@filterTasks.js', params);

  // Cache result
  await queryCache.set('filterTasks', params, result);

  return result;
}
```

### Write tool primitives (example: editItem.ts)

```typescript
import { queryCache } from '../../utils/cache.js';

export async function editItem(params: EditItemParams) {
  const result = await executeOmniFocusScript('@editTask.js', params);

  // Invalidate cache after write
  queryCache.invalidateOnWrite();

  return result;
}
```

---

## Implementation Notes

- Checksum is lightweight: just counts + latest mod time
- Cache hit avoids OmniFocus call entirely (except checksum verification)
- Checksum verification itself is cached for 5 seconds
- Write operations invalidate entire cache (simple, safe)
- Consider operation-specific TTLs in future (tags change rarely vs tasks)

**Trade-offs:**
- Adds complexity
- Potential for stale data if checksum misses a change
- Memory usage for cache entries

**When to use:**
- Most valuable for repeated identical queries
- Less valuable if user constantly modifies data

---

## Acceptance Criteria

- [ ] Cache stores query results with checksum
- [ ] Cached results served when checksum matches
- [ ] Cache invalidated when checksum changes
- [ ] Cache invalidated on write operations
- [ ] Max age limit prevents stale data
- [ ] Max entries limit prevents memory bloat
- [ ] At least 2 read tools use cache (filterTasks, getTaskById)
- [ ] All write tools invalidate cache
- [ ] Version bump in package.json

---

## Future Enhancements

- Per-operation TTL configuration
- Cache statistics (hit rate, invalidation count)
- Selective invalidation (only invalidate affected queries)

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Checksum-Based Cache Invalidation" section
- PERFORMANCE_AND_PATTERNS.md: "Cache TTL Tuning by Operation Type" section
