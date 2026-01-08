# Performance Insights and Development Patterns

Learnings extracted from multiple OmniFocus MCP implementations. These insights represent hard-won discoveries about JXA, OmniJS, and OmniFocus automation.

---

## Critical Performance Discoveries
*Source: omnifocus-mcp-archive*

### The `whose()` Catastrophe

JXA's `whose()` method is catastrophically slow for complex queries.

| Method | Time | Recommendation |
|--------|------|----------------|
| `whose()` with complex filters | 25,000ms | **AVOID** |
| Manual iteration with filter | 3,400ms | 7x faster |
| Get all tasks, then filter | 127ms | Best for bulk |

**Safe `whose()` patterns:**

```javascript
// GOOD - Single ID lookup
doc.flattenedTasks.whose({id: taskId})

// GOOD - Simple boolean
doc.flattenedTasks.whose({completed: false})

// BAD - Complex date/multi-field queries (25+ seconds!)
doc.flattenedTasks.whose({
  completed: false,
  dueDate: {">": startDate, "<": endDate}
})
```

**Rule:** Reserve `whose()` ONLY for single ID lookups or simple boolean filters. Use manual iteration for anything else.

---

### Pure OmniJS Bridge Performance

For bulk operations, pure OmniJS via `evaluateJavascript()` is dramatically faster.

| Operation Type | JXA Time | OmniJS Time | Improvement |
|----------------|----------|-------------|-------------|
| Task velocity analytics | 67.6s | <1s | **67x** |
| Productivity stats | 8-10s | <1s | **8-10x** |
| List tags | 13-67s | <1s | **13-67x** |

**Why OmniJS wins:**
- Direct property access: ~0.001ms per item (vs ~1-2ms in JXA)
- No cross-context bridge overhead
- Single execution context

---

### Helper Import Bloat

Importing a large unified helper bundle (~30KB) into every script adds unnecessary overhead.

**Problem:**
- Each script imports entire helper bundle
- Most scripts use <10% of functions
- Size compounds across multiple script calls

**Solution:**
- Create modular, focused helpers
- Pure OmniJS scripts need no helpers
- Only import what's actually used

---

## Three-Tier Script Architecture
*Source: omnifocus-mcp-archive*

Different operations benefit from different approaches:

### Tier 1: Pure OmniJS Bridge (Fastest)

Use when entire operation can happen in OmniJS.

```javascript
app.evaluateJavascript(`
  (() => {
    // All logic here - no JXA interaction
    const tasks = flattenedTasks.filter(t => !t.completed);
    return JSON.stringify(tasks.map(t => ({
      id: t.id.primaryKey,
      name: t.name
    })));
  })()
`);
```

**Best for:** Analytics, bulk reads, complex calculations

### Tier 2: JXA with Targeted Bridge Calls

Use when mostly JXA but need bridge for specific operations.

```javascript
// JXA for most operations
const task = doc.flattenedTasks.whose({id: taskId})[0];
task.name = "New Name";

// Bridge only for operations JXA can't do
app.evaluateJavascript(`
  const task = Task.byIdentifier("${taskId}");
  task.repetitionRule = new Task.RepetitionRule("FREQ=DAILY", Task.RepetitionMethod.Fixed);
`);
```

**Best for:** CRUD operations needing tags, repetition, or planned dates

### Tier 3: Pure JXA (Simplest)

Use when no bridge-specific operations needed.

```javascript
const doc = app.defaultDocument;
const task = new app.InboxTask({name: "New Task"});
doc.inboxTasks.push(task);
```

**Best for:** Simple operations, maximum maintainability

---

## Operations Requiring evaluateJavascript() Bridge
*Source: omnifocus-mcp-archive*

Some OmniFocus operations are only available via OmniJS, not JXA:

| Operation | Why Bridge Required |
|-----------|---------------------|
| Tag assignment | JXA tag objects don't persist correctly |
| Repetition rules | `Task.RepetitionRule` is OmniJS-only |
| Planned date setting | OmniFocus 4.7+ feature, OmniJS-only |
| Moving tasks between projects | More reliable via bridge |
| Complex rule objects | JXA can't construct them |

**Pattern:**

```javascript
// Create/find item in JXA
const taskId = task.id();

// Bridge to OmniJS for advanced operations
app.evaluateJavascript(`
  const task = Task.byIdentifier("${taskId}");
  // OmniJS-only operations here
`);
```

---

## Common Gotchas and Solutions
*Source: omnifocus-mcp-archive*

### JXA Property Access Requires Parentheses

```javascript
// WRONG - Returns function reference or undefined
const name = task.name;

// RIGHT - JXA proxy objects need method calls
const name = task.name();
```

### flattenedTasks vs tasks

```javascript
// WRONG - Only returns root-level tasks (usually none)
const tasks = doc.tasks();

// RIGHT - Recursive, gets all tasks including subtasks
const tasks = doc.flattenedTasks();
```

### whose() on Collections, Not Arrays

```javascript
// WRONG - whose() only works on collection functions
const filtered = doc.flattenedTasks().whose({...});

// RIGHT - Call whose() before getting array
const filtered = doc.flattenedTasks.whose({...});
```

### Script Size Limit (~50KB)

Scripts over ~50KB get truncated by osascript, causing cryptic "Unexpected end of script" errors.

**Solution:** Don't inline large data. Use JSON strings:

```javascript
// Instead of inline data
const hugeArray = [/* 1000 items inline */];

// Pass as argument, parse inside
const data = JSON.parse(injectedArgs.data);
```

### Bridge Consistency

Writing via `evaluateJavascript()` but reading via JXA can cause invisible changes.

**Solution:** Use same context for related operations, or refresh data after bridge operations.

---

## Performance Profiling Insights
*Source: omnifocus-mcp-archive*

For databases with 2000+ tasks:

| Operation | Time | % of Total |
|-----------|------|-----------|
| JXA bridge overhead | 3,736ms | 68% |
| Property access (per task) | ~1ms | 18% |
| Task enumeration | 292ms | 5% |
| SafeGet wrapper overhead | 200ms | 4% |

**Key insight:** Even with perfect optimization, JXA queries top out around 3-4 seconds due to bridge overhead. Sub-second requires architectural changes (OmniJS, caching, batch operations).

---

## Testing Best Practices
*Source: omnifocus-mcp-archive*

### Use Real Data

Sample databases (25 items) hide real performance characteristics. Test with actual user databases (2000+ tasks).

### Test Identifiers for Cleanup

Use unique identifiers for test items to enable easy cleanup:

```javascript
const testName = `@mcp-test-${Date.now()} Test Task`;
```

### Document Failed Approaches

When something doesn't work, document why. Prevents repeating mistakes and helps others.

---

## Abandoned Approaches (What NOT to Do)
*Source: omnifocus-mcp-archive*

| Approach | Why It Failed |
|----------|---------------|
| `Task.byIdentifier()` in JXA | OmniJS-only API |
| `task.markComplete()` without proper syntax | Inconsistent behavior |
| Complex `whose()` queries | 25+ second performance |
| Importing full helper bundle | 30KB overhead per script |
| Direct property access without `()` | JXA proxy behavior |
| `doc.tasks()` for all tasks | Only gets root level |

---

## Caching and Batch Optimization Patterns
*Source: omnifocus-mcp (TypeScript original)*

Analysis of the original TypeScript implementation revealed useful patterns:

### Checksum-Based Cache Invalidation

Lightweight approach to detect database changes without full data comparison:

```javascript
// Generate checksum from 3 data points
const taskCount = flattenedTasks.length;
const projectCount = flattenedProjects.length;
let latestMod = new Date(0);
flattenedTasks.forEach(task => {
  if (task.modificationDate && task.modificationDate > latestMod)
    latestMod = task.modificationDate;
});
return `${taskCount}-${projectCount}-${latestMod.getTime()}`;
```

**Use case:** Cache dump_database results and only refresh when checksum changes.

**Caveat:** This won't catch tag-only or folder-only changes. For complete detection, include tag count and folder count.

### Cycle Detection in Batch Operations

Pre-validation catches circular parent references before attempting to create items:

```javascript
// DFS cycle detection with path capture
function detectCycles(items) {
  const visiting = new Set();
  const visited = new Set();

  function dfs(tempId, stack) {
    if (visited.has(tempId)) return null;
    if (visiting.has(tempId)) {
      // Cycle found - return path for error message
      return stack.slice(stack.indexOf(tempId)).concat(tempId);
    }
    visiting.add(tempId);
    stack.push(tempId);

    const item = items.find(i => i.tempId === tempId);
    if (item.parentTempId) {
      const cycle = dfs(item.parentTempId, stack);
      if (cycle) return cycle;
    }

    stack.pop();
    visiting.delete(tempId);
    visited.add(tempId);
    return null;
  }

  for (const item of items) {
    const cycle = dfs(item.tempId, []);
    if (cycle) {
      const names = cycle.map(id => items.find(i => i.tempId === id).name);
      throw new Error(`Circular reference: ${names.join(' → ')}`);
    }
  }
}
```

**Benefit:** Users get clear error messages like "Circular reference: Task A → Task B → Task A" instead of silent failures.

### Hierarchy Level Hints for Batch Processing

Support `hierarchyLevel` parameter to optimize processing order:

```javascript
// Sort by hierarchy level, then by original index for stability
const sorted = items
  .map((item, idx) => ({ ...item, __index: idx }))
  .sort((a, b) =>
    (a.hierarchyLevel ?? 0) - (b.hierarchyLevel ?? 0) ||
    a.__index - b.__index
  );

// Process in waves - parents before children
let madeProgress = true;
while (pendingItems.length > 0 && madeProgress) {
  madeProgress = false;
  for (const item of sorted) {
    if (item.parentTempId && !created.has(item.parentTempId)) {
      continue; // Wait for parent
    }
    // Create item...
    madeProgress = true;
  }
}
```

**Benefit:** Handles deeply nested hierarchies without requiring specific ordering from the caller.

### Unified Query Tool Trade-offs

omnifocus-mcp uses a single `query_omnifocus` tool that generates filter scripts at runtime:

```typescript
// Single tool handles all entity types and filters
function generateQueryScript(entity: string, filters: Filter[]): string {
  return `(() => {
    let items = ${getEntityCollection(entity)};
    items = items.filter(item => {
      ${filters.map(f => generateFilterCondition(f)).join(' && ')}
    });
    return JSON.stringify(items);
  })()`;
}
```

**Trade-offs:**
- ✅ Simpler API surface (one tool vs. many)
- ✅ Dynamic filter composition
- ❌ Harder to optimize individual filter types
- ❌ No per-filter caching opportunities
- ❌ Script size can balloon with complex queries

**of-mcp decision:** Multiple specialized tools (filter_tasks, get_inbox_tasks, etc.) enable per-operation optimization and clearer error handling.

---

## Permission Handling and Error Recovery
*Source: omnifocus-mcp (third implementation)*

### URL Scheme Fallback for Permission Issues

When osascript fails due to permission errors, use OmniFocus URL scheme as fallback:

```javascript
async function executeViaUrlScheme(script) {
  const encoded = encodeURIComponent(script);
  const url = `omnifocus:///omnijs-run?script=${encoded}`;
  // Open URL via system command
  // Note: Use execFile for safety in production code
}
```

**Use case:** When users haven't granted Automation permissions, the URL scheme can still trigger scripts (with user confirmation dialog).

**Limitation:** Cannot return results - fire-and-forget only. Use for operations where success can be verified separately.

### Permission Checker Singleton

Cache permission status to avoid repeated checks:

```typescript
class PermissionChecker {
  private static instance: PermissionChecker;
  private permissionGranted: boolean | null = null;

  static getInstance(): PermissionChecker {
    if (!this.instance) this.instance = new PermissionChecker();
    return this.instance;
  }

  async check(): Promise<boolean> {
    if (this.permissionGranted !== null) return this.permissionGranted;
    try {
      await executeSimpleScript('return "ok"');
      this.permissionGranted = true;
    } catch (e) {
      if (e.code === -1743) { // Permission denied
        this.permissionGranted = false;
      }
    }
    return this.permissionGranted;
  }

  resetCache(): void {
    this.permissionGranted = null;
  }
}
```

**Error codes to detect:**
- `-1743`: Permission denied (needs System Preferences grant)
- `-600`: Application not running

### Structured Error Responses

Include actionable instructions in error responses:

```typescript
if (error.code === -1743) {
  return {
    error: true,
    code: 'PERMISSION_DENIED',
    message: 'OmniFocus automation permission required',
    instructions: [
      '1. Open System Preferences > Privacy & Security > Automation',
      '2. Find your terminal app (Terminal, iTerm, etc.)',
      '3. Enable the checkbox for OmniFocus',
      '4. Restart the MCP server'
    ]
  };
}
```

---

## Performance Optimization Techniques
*Source: omnifocus-mcp (third implementation)*

### availableTasks() vs flattenedTasks()

Critical performance decision:

```javascript
// SLOW - gets ALL tasks including completed/dropped
const tasks = flattenedTasks;  // 2000+ items, 3-4 seconds

// FAST - excludes completed/dropped
const tasks = doc.availableTasks();  // 200-500 items, <1 second
```

**Decision tree:**
- Need completed tasks? → `flattenedTasks`
- Filtering out completed anyway? → `availableTasks()` (much faster)
- Analytics on all history? → `flattenedTasks`
- Active task list? → `availableTasks()`

### Optional Heavy Operations

Make expensive computations opt-in:

```typescript
// Schema with opt-in expensive parameter
const schema = z.object({
  includeUsageStats: z.boolean().optional().default(false)
    .describe("Include tag usage counts (slow - iterates all tasks)")
});

// Implementation branches on parameter
if (params.includeUsageStats) {
  // Expensive: iterate all tasks to count usage
  tag.usageCount = flattenedTasks.filter(t =>
    t.tags.some(tt => tt.id === tag.id)
  ).length;
}
```

**Real performance impact:**
- Without stats: ~4 seconds
- With stats: 15+ minutes

### Concurrency-Limited Batch Execution

Parallel execution with backpressure:

```typescript
async function executeBatch(scripts: string[], concurrency = 3): Promise<Result[]> {
  const results: Result[] = [];

  for (let i = 0; i < scripts.length; i += concurrency) {
    const batch = scripts.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(script => executeScript(script))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error('Batch item failed:', result.reason);
      }
    }
  }

  return results;
}
```

**Benefits:**
- Prevents overwhelming OmniFocus with parallel requests
- Partial success - failed items don't block others
- Configurable concurrency based on system capacity

### Partial Failure Semantics

For bulk operations, continue on partial failure:

```typescript
async function bulkExport(categories: string[]): Promise<BulkResult> {
  const results: Record<string, any> = {};
  const failures: Record<string, string> = {};

  for (const category of categories) {
    try {
      results[category] = await exportCategory(category);
    } catch (e) {
      failures[category] = e.message;
      // Continue with remaining categories
    }
  }

  return {
    success: Object.keys(failures).length === 0,
    partialResults: results,
    failures: failures
  };
}
```

**When to use:** Bulk operations where partial data is better than no data.

---

## Data Normalization Patterns
*Source: omnifocus-mcp (third implementation)*

### Project Status String Normalization

OmniFocus returns status with " status" suffix:

```javascript
// Raw from OmniFocus
project.status()  // Returns: "active status", "done status", "dropped status"

// Normalize for clean API
const status = project.status().replace(/ status$/, '');
// Returns: "active", "done", "dropped"
```

### Frequency Description Generation

Convert repetition rules to human-readable text:

```javascript
function describeFrequency(rule) {
  const unit = rule.unit;  // 'day', 'week', 'month', 'year'
  const steps = rule.steps || 1;

  const unitNames = {
    day: ['daily', 'days'],
    week: ['weekly', 'weeks'],
    month: ['monthly', 'months'],
    year: ['yearly', 'years']
  };

  if (steps === 1) {
    return unitNames[unit][0];  // "daily", "weekly", etc.
  } else if (unit === 'month' && steps === 3) {
    return 'Quarterly';
  } else if (unit === 'month' && steps === 6) {
    return 'Semi-annually';
  } else {
    return `Every ${steps} ${unitNames[unit][1]}`;  // "Every 3 weeks"
  }
}
```

---

## Logging Best Practices
*Source: omnifocus-mcp (third implementation)*

### Structured Logging to stderr

Keep stdout JSON-pure for MCP protocol:

```typescript
class Logger {
  private level: LogLevel;

  constructor(level: string = process.env.LOG_LEVEL || 'info') {
    this.level = this.parseLevel(level);
  }

  debug(context: string, message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      this.write('DEBUG', context, message, data);
    }
  }

  private write(level: string, context: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] [${context}] ${message}`;

    // Write to stderr, NOT stdout (stdout is for MCP JSON responses)
    process.stderr.write(line + '\n');

    if (data) {
      process.stderr.write(JSON.stringify(data, null, 2) + '\n');
    }
  }
}
```

**Why stderr?**
- MCP protocol uses stdout for JSON-RPC messages
- Logging to stdout corrupts the protocol stream
- stderr is visible in terminal but doesn't interfere

### Cache TTL Tuning by Operation Type

Different operations warrant different cache durations:

| Operation Type | TTL | Rationale |
|---------------|-----|-----------|
| Tasks | 60s | Change frequently |
| Projects | 600s (10min) | Change less often |
| Tags | 1200s (20min) | Rarely change |
| Analytics | 3600s (1hr) | Historical, stable |

---

## Alternative Approaches
*Source: omnifocus-mcp (Python implementation)*

Analysis of a Python-based OmniFocus MCP server revealed useful context:

### HTTP REST API Option

omnifocus-mcp provides both MCP and FastAPI REST endpoints. This dual-interface pattern could be useful if non-MCP clients need access:

```python
# Pattern: FastAPI alongside MCP
@app.get("/tasks")
async def list_tasks():
    return await run_applescript("list_tasks.applescript")
```

**Current decision:** of-mcp is MCP-only. REST API could be added if needed.

### Task.Status Enum Constants

OmniJS provides status constants for task filtering:

```javascript
Task.Status.Available   // Can be worked on now
Task.Status.Blocked     // Blocked by prerequisites
Task.Status.Completed   // Done
Task.Status.Dropped     // Abandoned
Task.Status.DueSoon     // Due within threshold
Task.Status.Next        // Next action in project
Task.Status.Overdue     // Past due date
```

Use these for explicit status checks rather than string comparisons.

### AppleScript vs Pure OmniJS

Two approaches exist for OmniFocus automation:

**AppleScript-wrapped OmniJS** (omnifocus-mcp approach):
```applescript
set jsCode to "flattenedTasks.filter(t => !t.completed)"
return evaluate javascript jsCode
```

**Pure OmniJS** (of-mcp approach):
```javascript
(() => {
  return JSON.stringify(flattenedTasks.filter(t => !t.completed));
})()
```

**Why pure OmniJS is better:**
- More readable and maintainable
- No escaping issues between languages
- Better tooling support (JS linters, etc.)
- Shared utilities can be injected

### Python Alternative

For simple MCP servers, Python + AppleScript is faster to prototype:
- No build/compile step
- Fewer dependencies
- Simpler subprocess model

**Trade-off:** Loses TypeScript's type safety and Zod validation. of-mcp's approach is better for production but Python is viable for experimentation.

---

## Transport Text and FastMCP Patterns
*Source: omnifocus-mcp-python (FastMCP implementation)*

### Transport Text Parsing

OmniFocus has a built-in `Task.byParsingTransportText()` method that parses a special syntax for creating tasks with attributes in one call:

```javascript
// Transport text syntax
const transportText = "Task name ::ProjectName @tag1 @tag2 #deferDate #dueDate !";

// Syntax breakdown:
// ::Project     - Assign to project (colon-colon prefix)
// @tagName      - Add tag (at-sign prefix)
// #date         - First # is defer date, second # is due date
// !             - Flag the task

// Create task from transport text
const tasks = Task.byParsingTransportText(transportText);
const task = tasks[0];
task.note = "Optional note set separately";
```

**Benefits:**
- Single API call creates task with project, tags, dates, and flag
- OmniFocus handles natural language date parsing ("tomorrow", "next friday", "2d")
- Cleaner than setting each property individually

**Use cases:**
- Quick task creation with multiple attributes
- When you want OmniFocus's native date parsing
- Building "quick entry" style interfaces

### FastMCP Decorator Pattern

Python's FastMCP provides a cleaner alternative to TypeScript's Zod schemas:

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("server-name", "Server description")

@mcp.tool()
def add_task(
    name: str,                          # Required - type hint is required
    note: Optional[str] = None,         # Optional with default
    tags: Optional[List[str]] = None,   # List types work
    flagged: bool = False               # Defaults work
) -> str:                               # Return type is enforced
    """
    Brief description becomes tool description.

    Args:
        name: Parameter descriptions become schema descriptions.
        note: Optional note for the task.

    Returns:
        Success message with task ID.
    """
    # Implementation
    return f"Created task with ID: {task_id}"
```

**Key differences from TypeScript/Zod:**
- Type hints become schema automatically
- Docstrings become tool descriptions
- No separate schema definition file needed
- Less boilerplate, but less explicit validation

### JXA Wrapper for OmniJS Execution

Alternative to AppleScript wrapping - use JXA directly:

```python
def run_omnifocus_omnijs(omnijs_code: str) -> Any:
    """Execute OmniJS via JXA wrapper."""
    # Escape backticks for template literal
    escaped_code = omnijs_code.replace('`', '\\`')

    jxa_wrapper = f"""
    const app = Application('OmniFocus');
    const result = app.evaluateJavascript(`{escaped_code}`);
    JSON.stringify(result);
    """

    proc = subprocess.run(
        ["/usr/bin/osascript", "-l", "JavaScript"],
        input=jxa_wrapper,
        capture_output=True,
        text=True,
        check=True,
    )

    return json.loads(proc.stdout.strip())
```

**Advantages over AppleScript wrapper:**
- Native JSON handling (no string escaping issues)
- Template literals for cleaner code injection
- Better error messages from JXA

### Content Tree Navigation for Perspectives

Getting tasks from a custom perspective requires navigating the content tree:

```javascript
(() => {
    const perspective = perspectives.byName['My Perspective'];
    if (!perspective) return { error: "Perspective not found" };

    // Set the perspective on a window to populate its content
    const window = document.windows[0];
    window.perspective = perspective;

    // Navigate the content tree
    const tree = window.content;
    const tasks = [];

    function extractTasks(items) {
        items.forEach(item => {
            if (item.object instanceof Task) {
                tasks.push({
                    id: item.object.id.primaryKey,
                    name: item.object.name,
                    project: item.object.containingProject?.name
                });
            }
            // Recursively process children
            if (item.children) {
                extractTasks(item.children);
            }
        });
    }

    if (tree?.rootNode?.children) {
        extractTasks(tree.rootNode.children);
    }

    return tasks;
})()
```

**Important notes:**
- Requires setting `window.perspective` first
- Content tree contains both tasks and section headers
- Check `item.object instanceof Task` to filter to actual tasks
- Children may be nested arbitrarily deep

### Project Task Iteration via rootTask

Access project tasks through the root task's children:

```javascript
// Get all tasks in a project (including nested)
const project = projects.byName['My Project'];
const allTasks = project.flattenedTasks;  // All tasks, flattened

// Get only top-level tasks
const topLevelTasks = project.rootTask.children;

// Recursive mapping with depth limit
function mapTask(task, depth = 0, maxDepth = 3) {
    if (depth >= maxDepth) return null;

    return {
        id: task.id.primaryKey,
        name: task.name,
        children: task.children
            .map(child => mapTask(child, depth + 1, maxDepth))
            .filter(c => c !== null)
    };
}

const taskTree = project.rootTask.children.map(t => mapTask(t, 0));
```

---

## Database Safety and Query Optimization
*Source: omnifocus-mcp (fourth implementation - Python/AppleScript)*

### Multi-Layer Database Safety

Three-tier protection pattern for database operations:

```python
class OmniFocusDB:
    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()
        self._last_check = None

    def get_tasks(self, filters=None):
        with self._lock:  # Layer 1: Thread safety
            try:
                self._validate_connection()  # Layer 2: Connection check
                result = self._execute_query(filters)
                self._validate_result(result)  # Layer 3: Result validation
                return result
            except OmniFocusError as e:
                self._handle_graceful_degradation(e)
```

**Why three layers?**
- Thread lock prevents concurrent AppleScript race conditions
- Connection validation catches OmniFocus restarts/crashes
- Result validation catches schema changes or corrupted responses

### N+1 Query Elimination

Anti-pattern that causes 8.5x slowdown:

```python
# BAD: N+1 query pattern (8.5x slower)
def get_tasks_with_projects():
    tasks = execute_script("get_all_tasks")  # 1 query
    for task in tasks:
        task["project"] = execute_script(f"get_project({task['project_id']})")  # N queries
    return tasks

# GOOD: Batch fetch, then filter (8.5x faster)
def get_tasks_with_projects():
    tasks = execute_script("get_all_tasks")  # 1 query
    projects = execute_script("get_all_projects")  # 1 query
    project_map = {p["id"]: p for p in projects}

    for task in tasks:
        task["project"] = project_map.get(task["project_id"])
    return tasks
```

**Real-world impact:**
- 100 tasks with N+1: ~8.5 seconds
- Same with batch fetch: ~1 second

### Entity Relationships Pre-Loading

For operations needing entity relationships, pre-load everything:

```javascript
// Single OmniJS execution fetches everything
const data = {
    tasks: flattenedTasks.map(t => ({
        id: t.id.primaryKey,
        name: t.name,
        projectId: t.containingProject?.id.primaryKey,
        tagIds: t.tags.map(tag => tag.id.primaryKey)
    })),
    projects: flattenedProjects.map(p => ({
        id: p.id.primaryKey,
        name: p.name,
        folderId: p.parentFolder?.id.primaryKey
    })),
    tags: flattenedTags.map(t => ({
        id: t.id.primaryKey,
        name: t.name,
        parentId: t.parent?.id.primaryKey
    }))
};
return JSON.stringify(data);
```

**Then join in application code** - much faster than repeated AppleScript calls.

---

## Testing Patterns
*Source: omnifocus-mcp (fourth implementation)*

### UUID-Based Test Fixtures

Deterministic test IDs for reliable assertions:

```python
import uuid

class TestFixtures:
    # Fixed UUIDs for test data - same across all test runs
    TASK_UUID = uuid.UUID("12345678-1234-1234-1234-123456789abc")
    PROJECT_UUID = uuid.UUID("87654321-4321-4321-4321-cba987654321")

    @classmethod
    def create_test_task(cls, name="Test Task"):
        return {
            "id": str(cls.TASK_UUID),
            "name": name,
            "completed": False
        }
```

**Benefits:**
- Tests are deterministic (same ID every run)
- Easy to identify test data vs real data
- Cleanup scripts can target specific UUIDs

### Scoped Pytest Fixtures

Fixture scoping for efficient test setup:

```python
@pytest.fixture(scope="module")
def omnifocus_connection():
    """Module-scoped: one connection per test file."""
    conn = OmniFocusDB()
    conn.connect()
    yield conn
    conn.disconnect()

@pytest.fixture(scope="function")
def test_task(omnifocus_connection):
    """Function-scoped: fresh task per test."""
    task = omnifocus_connection.create_task("Test Task")
    yield task
    omnifocus_connection.delete_task(task["id"])

@pytest.fixture(scope="session")
def expensive_database_dump():
    """Session-scoped: once per entire test run."""
    return execute_script("dump_full_database")
```

**Scope guidelines:**
- `session`: Very expensive operations (full DB dumps)
- `module`: Connection setup, shared config
- `function`: Test-specific data that needs isolation

### Version Sync Enforcement

Fail fast when versions don't match:

```python
def check_version_sync():
    """Ensure package.json and server.py versions match."""
    with open("package.json") as f:
        pkg_version = json.load(f)["version"]

    # Read version from Python module
    import of_mcp
    server_version = of_mcp.__version__

    if pkg_version != server_version:
        raise RuntimeError(
            f"Version mismatch: package.json={pkg_version}, "
            f"server={server_version}. Run 'npm run sync-version'"
        )
```

**of-mcp approach:** Single source of truth in `package.json`, read at runtime in `server.ts`.

---

## API Design Patterns
*Source: omnifocus-mcp (fourth implementation)*

### Union Type API Pattern

Flexible parameter handling using union types:

```python
from typing import Union

def get_task(identifier: Union[str, int, dict]) -> Task:
    """
    Accept multiple identifier formats:
    - str: Task ID like "abc123"
    - int: Legacy numeric ID
    - dict: Query object like {"name": "My Task"}
    """
    if isinstance(identifier, str):
        return Task.by_id(identifier)
    elif isinstance(identifier, int):
        return Task.by_legacy_id(identifier)
    elif isinstance(identifier, dict):
        return Task.query_one(identifier)
    else:
        raise ValueError(f"Invalid identifier type: {type(identifier)}")
```

**TypeScript equivalent (of-mcp style):**

```typescript
const taskIdentifier = z.union([
  z.string().describe("Task ID"),
  z.object({ name: z.string() }).describe("Query by name"),
  z.object({ id: z.string(), projectId: z.string() }).describe("Compound key")
]);
```

**Benefits:**
- Backwards compatibility when adding new identifier types
- Clear documentation of what's accepted
- Runtime validation catches misuse early

### Graceful Degradation Pattern

When optional features fail, continue with reduced functionality:

```python
def get_task_details(task_id: str) -> dict:
    """Get task with optional expensive enrichment."""
    task = get_basic_task(task_id)

    # Try expensive operations, but don't fail if they error
    try:
        task["project_details"] = get_project_details(task["project_id"])
    except Exception as e:
        logger.warning(f"Could not enrich project: {e}")
        task["project_details"] = None

    try:
        task["time_tracked"] = calculate_time_tracked(task_id)
    except Exception as e:
        logger.warning(f"Could not get time tracking: {e}")
        task["time_tracked"] = None

    return task
```

**When to use:** Optional enrichment that shouldn't block the primary operation.

---

## References

### omnifocus-mcp-archive (development journey documentation)
- `/journey/performance/PERFORMANCE_BREAKTHROUGH.md`
- `/journey/technical/JXA_CAPABILITIES_AUDIT.md`
- `/learning-docs/ABANDONED_APPROACHES.md`
- `/2025-12-23-consolidation-docs/helper-pain-points.md`

### omnifocus-mcp (TypeScript original - of-mcp fork source)
- `src/utils/cacheManager.ts` - Checksum-based cache invalidation
- `src/tools/primitives/batchAddItems.ts` - Cycle detection, hierarchy hints

### omnifocus-mcp (third implementation)
- `src/omnifocus/OmniAutomation.ts` - URL scheme fallback, batch execution
- `src/utils/permissions.ts` - Permission checker singleton
- `src/utils/logger.ts` - Structured logging to stderr
- `src/omnifocus/scripts/*.ts` - availableTasks() optimization, status normalization

### omnifocus-mcp (Python-based alternative implementation)
- `mcp_server.py` - FastAPI + MCP dual interface
- `scripts/*.applescript` - AppleScript-wrapped OmniJS patterns

### omnifocus-mcp (fourth implementation - Python/AppleScript)
- `src/database.py` - Multi-layer safety, N+1 elimination, connection validation
- `tests/fixtures.py` - UUID-based test fixtures, scoped pytest patterns
- `src/api/tasks.py` - Union type API pattern, graceful degradation

### omnifocus-mcp-python (FastMCP implementation)
- `src/omnifocus_server.py` - Transport text parsing, JXA wrapper, content tree navigation
- `FASTMCP_DEVELOPMENT_GUIDE.md` - FastMCP decorator patterns, testing strategy
- `MCP_INTEGRATION_PATTERNS.md` - Claude Code/Codex integration, Python path selection

---

## Changelog

- 2026-01-07: Initial documentation from omnifocus-mcp-archive analysis
- 2026-01-07: Added alternative approaches from omnifocus-mcp (Python) comparison
- 2026-01-07: Added caching and batch patterns from omnifocus-mcp (TypeScript original)
- 2026-01-07: Added permission handling, performance optimization, logging patterns from omnifocus-mcp (third implementation)
- 2026-01-07: Added database safety, N+1 elimination, testing patterns, API design from omnifocus-mcp (fourth implementation)
- 2026-01-07: Added transport text parsing, FastMCP patterns, content tree navigation from omnifocus-mcp-python
