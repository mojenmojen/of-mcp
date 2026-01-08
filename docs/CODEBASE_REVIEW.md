# OmniFocus MCP Server - Comprehensive Codebase Review

> **Review Date**: January 2026
> **Branch**: `docs/feature-requests`
> **Focus Areas**: Performance, Redundant Code, Outdated Patterns, Best Practices

This document provides a critical review of the OmniFocus MCP server codebase, identifying opportunities for improvement across performance, code clarity, and best practices. Each finding is actionable and can be converted to a feature request or bug fix.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues](#critical-issues)
3. [High Priority Issues](#high-priority-issues)
4. [Medium Priority Issues](#medium-priority-issues)
5. [Low Priority Issues](#low-priority-issues)
6. [Recommended Action Plan](#recommended-action-plan)

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Performance | 4 | 7 | 6 | 3 | 20 |
| Code Redundancy | 2 | 6 | 4 | 3 | 15 |
| Outdated Patterns | 2 | 3 | 4 | 6 | 15 |
| Best Practices | 8 | 12 | 18 | 9 | 47 |
| **Deduplicated Total** | **10** | **15** | **20** | **12** | **57** |

**Key Themes Identified:**
1. **Type Safety Gaps** - Widespread use of `any` and unsafe type casting
2. **Code Duplication** - Same patterns repeated across 24+ files
3. **Performance Anti-patterns** - O(n²) algorithms, missing caching, inefficient queries
4. **Inconsistent Error Handling** - No standardized approach across tools
5. **Dead/Outdated Code** - Disabled features, unused scripts, stale comments

---

## Critical Issues

### CR-01: Dangerous Type Casting Pattern
**Category**: Best Practices
**Effort**: Quick fix
**Files**: All 40+ tool definition files

**Problem**: All error handlers use unsafe `as Error` cast:
```typescript
catch (err: unknown) {
  const error = err as Error;  // DANGEROUS - assumes err has .message
  console.error(`Tool execution error: ${error.message}`);
}
```

**Impact**: Throws secondary error if `err` is string, null, or object without `.message`

**Solution**:
```typescript
catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Tool execution error: ${message}`);
}
```

---

### CR-02: Widespread `any` Type Usage (72+ occurrences)
**Category**: Best Practices
**Effort**: Significant
**Files**: All primitives and utilities

**Problem**: Script results cast to `any` without validation:
```typescript
const data = result as any;
if (data.success) { ... }  // No type safety
```

**Impact**:
- Defeats TypeScript's type checking
- Hides bugs in data transformation
- Makes refactoring dangerous

**Solution**: Define explicit interfaces for each script result:
```typescript
interface FilterTasksResult {
  success: boolean;
  tasks?: OmnifocusTask[];
  error?: string;
  totalCount?: number;
}
```

---

### CR-03: O(n²) Tag Deduplication Algorithm
**Category**: Performance
**Effort**: Quick fix
**File**: `src/utils/omnifocusScripts/tasksByTag.js:106`

**Problem**:
```javascript
tags.forEach(tag => {
  if (!allMatchedTags.find(t => t.id.primaryKey === tag.id.primaryKey)) {
    allMatchedTags.push(tag);
  }
});
```

**Impact**: With 1000 tags, performs up to 500,000 comparisons

**Solution**: Use Set for O(1) lookups:
```javascript
const seenTagIds = new Set();
tags.forEach(tag => {
  const tagId = tag.id.primaryKey;
  if (!seenTagIds.has(tagId)) {
    seenTagIds.add(tagId);
    allMatchedTags.push(tag);
  }
});
```

---

### CR-04: Repeated O(n) Tag Lookups in Batch Operations
**Category**: Performance
**Effort**: Quick fix
**File**: `src/utils/omnifocusScripts/batchEditItems.js:9-27, 253-280`

**Problem**:
```javascript
function findOrCreateTag(tagName) {
  for (const tag of flattenedTags) {  // O(n) every call
    if (tag.name.toLowerCase() === tagNameLower) return tag;
  }
}
// Called for each tag in each edit item
```

**Impact**: 100 edits × 5 tags × 1000 system tags = 500,000 iterations

**Solution**: Build lookup map once:
```javascript
const tagsByNameMap = new Map();
flattenedTags.forEach(t => tagsByNameMap.set(t.name.toLowerCase(), t));

function findOrCreateTag(tagName) {
  return tagsByNameMap.get(tagName.toLowerCase()) || new Tag(tagName);
}
```

---

### CR-05: Silent Error Swallowing in Script Execution
**Category**: Best Practices
**Effort**: Moderate
**File**: `src/utils/scriptExecution.ts:36-46`

**Problem**:
```typescript
catch (e) {
  console.error("Failed to parse script output as JSON:", e);
  if (stdout.includes("Found") && stdout.includes("tasks")) {
    return [];  // Silently returns empty array
  }
  return [];  // No indication of failure
}
```

**Impact**: Callers cannot distinguish "no results" from "error occurred"

**Solution**: Throw errors instead of returning empty arrays:
```typescript
catch (e) {
  throw new Error(`Failed to parse script output: ${stdout.substring(0, 200)}`);
}
```

---

### CR-06: JSON Parsing Boilerplate Repeated 24 Times
**Category**: Code Redundancy
**Effort**: Moderate
**Files**: All 24 primitive files

**Problem**: Identical 15-line JSON parsing block in every primitive:
```typescript
let parsed;
if (typeof result === 'string') {
  try {
    parsed = JSON.parse(result);
  } catch (e) {
    console.error("Failed to parse result as JSON:", e);
    return { success: false, error: `Failed to parse result: ${result}` };
  }
} else {
  parsed = result;
}
```

**Impact**: ~360 lines of duplicated code, maintenance nightmare

**Solution**: Create utility function in `scriptExecution.ts`:
```typescript
export function parseScriptResult<T>(result: unknown): T {
  if (typeof result === 'string') {
    return JSON.parse(result);
  }
  return result as T;
}
```

---

### CR-07: Task Status Enum Repeated in 7+ Scripts
**Category**: Code Redundancy
**Effort**: Quick fix
**Files**: `filterTasks.js`, `tasksByTag.js`, `flaggedTasks.js`, `inboxTasks.js`, `forecastTasks.js`, `batchFilterTasks.js`, `omnifocusDump.js`

**Problem**: Identical 10-line status mapping in each script:
```javascript
const taskStatusMap = {
  [Task.Status.Available]: "Available",
  [Task.Status.Blocked]: "Blocked",
  // ... 7 more lines
};
```

**Impact**: Changes require updating 7 files

**Solution**: Move to `lib/sharedUtils.js` (already injected into all scripts)

---

### CR-08: Repetition Rule Schema Duplicated 3 Times
**Category**: Code Redundancy
**Effort**: Quick fix
**Files**: `addOmniFocusTask.ts:7-30`, `editItem.ts:7-30`, `batchEditItems.ts:7-30`

**Problem**: Identical 24-line Zod schema in 3 files

**Solution**: Extract to shared schema file:
```typescript
// src/schemas/repetitionRule.ts
export const repetitionRuleSchema = z.object({...});
```

---

### CR-09: Fragile String-Based Parameter Injection
**Category**: Performance / Best Practices
**Effort**: Significant
**File**: `src/utils/scriptExecution.ts:97-141`

**Problem**:
```typescript
scriptContent = scriptContent.replace(
  /let perspectiveName = ".*"; \/\/ (?:Hardcode for testing|Default for testing)/,
  'let perspectiveName = injectedArgs.perspectiveName || null;'
);
// 8+ sequential regex replacements
```

**Impact**:
- Fragile: minor script changes break injection
- No verification that injection succeeded
- Difficult to debug when parameters don't arrive

**Solution**: Use structured parameter passing:
```javascript
// Script template
(() => {
  const args = __INJECTED_ARGS__;  // Single replacement point
  // ... script body
})()
```

---

### CR-10: Missing Input Validation for Dates and Ranges
**Category**: Best Practices
**Effort**: Moderate
**Files**: `addOmniFocusTask.ts`, `editItem.ts`, batch operations

**Problem**:
```typescript
// No validation of:
// - dueDate format (could be invalid string)
// - estimatedMinutes (could be negative)
// - Conflicting operations (move to project AND parent task)
```

**Impact**: Invalid data passed to OmniJS, causing silent failures or corruption

**Solution**: Add comprehensive validation:
```typescript
if (params.estimatedMinutes !== undefined && params.estimatedMinutes < 0) {
  return { success: false, error: "estimatedMinutes cannot be negative" };
}
if (params.dueDate && isNaN(Date.parse(params.dueDate))) {
  return { success: false, error: "Invalid dueDate format" };
}
```

---

## High Priority Issues

### HP-01: Disabled Tool Code Still in Codebase
**Category**: Outdated Code
**Effort**: Quick fix
**File**: `src/server.ts:12, 53-59`

**Problem**: `dump_database` tool commented out but definitions, primitives, and scripts still exist

**Solution**: Remove all associated files or re-enable the feature

---

### HP-02: Unused OmniJS Script
**Category**: Outdated Code
**Effort**: Quick fix
**File**: `src/utils/omnifocusScripts/yesterdayCompletedTasks.js`

**Problem**: Script exists but is never imported or referenced

**Solution**: Delete unused file

---

### HP-03: Dual Perspective Implementation (V1 vs V2)
**Category**: Outdated Code
**Effort**: Moderate
**Files**: `getCustomPerspectiveTasks.ts` (V1), `getPerspectiveTasksV2.ts` (V2, unregistered)

**Problem**:
- V2 uses modern `PerspectiveEngine` but is NOT registered in server.ts
- V1 is registered but uses older approach
- Creates confusion about which to use

**Solution**: Either register V2 as primary or remove it entirely

---

### HP-04: Excessive Console Logging (50+ instances)
**Category**: Best Practices
**Effort**: Moderate
**Files**: Multiple primitives and utilities

**Problem**:
```typescript
console.error("Executing OmniJS script for editItem...");  // Not an error!
console.log("Found tasks:", tasks.length);  // Debug left in production
```

**Impact**: Pollutes MCP server output, mixes debug info with actual errors

**Solution**: Remove debug logging or implement proper logging levels

---

### HP-05: Synchronous File Operations in Async Functions
**Category**: Outdated Patterns
**Effort**: Moderate
**File**: `src/utils/scriptExecution.ts:80, 85, 176, 182`

**Problem**:
```typescript
export async function executeOmniFocusScript(...) {
  let scriptContent = readFileSync(actualPath, 'utf8');  // Blocks event loop
  writeFileSync(tempFile, jxaScript);
  unlinkSync(tempFile);
}
```

**Solution**: Use `fs/promises` API:
```typescript
import { readFile, writeFile, unlink } from 'fs/promises';
const scriptContent = await readFile(actualPath, 'utf8');
```

---

### HP-06: Error Handling Boilerplate Repeated 27 Times
**Category**: Code Redundancy
**Effort**: Moderate
**Files**: All tool definition files

**Problem**: Identical error response pattern in every handler:
```typescript
catch (err: unknown) {
  const error = err as Error;
  return {
    content: [{ type: "text" as const, text: `Error [tool_name]: ${error.message}` }],
    isError: true
  };
}
```

**Solution**: Create `createErrorResponse(toolName, error)` utility

---

### HP-07: Multiple Date Object Creation in Sort
**Category**: Performance
**Effort**: Quick fix
**File**: `src/utils/omnifocusScripts/filterTasks.js:275-307`

**Problem**:
```javascript
filteredTasks.sort((a, b) => {
  const dateA = a.completionDate || new Date('1900-01-01');  // Creates object per comparison
  const dateB = b.completionDate || new Date('1900-01-01');
  return dateB - dateA;
});
```

**Impact**: Sorting 500 tasks creates ~9000 Date objects

**Solution**: Pre-compute timestamps before sorting

---

### HP-08: Redundant Map.has() + Map.get() Pattern
**Category**: Performance
**Effort**: Quick fix
**File**: `src/utils/omnifocusScripts/omnifocusDump.js:204-209`

**Problem**:
```javascript
if (tagsMap.has(tagID)) {
  tagsMap.get(tagID).tasks.push(taskData.id);  // Redundant lookup
}
```

**Solution**:
```javascript
const tag = tagsMap.get(tagID);
if (tag) tag.tasks.push(taskData.id);
```

---

### HP-09: No Script Execution Timeout
**Category**: Best Practices
**Effort**: Moderate
**File**: `src/utils/scriptExecution.ts`

**Problem**: Script execution has no timeout - could hang indefinitely if OmniFocus is frozen

**Solution**: Add timeout configuration to exec options

---

### HP-10: Incomplete Perspective Engine Rules
**Category**: Best Practices
**Effort**: Moderate
**File**: `src/utils/perspectiveEngine.ts`

**Problem**: Many filter rules return `true` without implementation:
- `actionRepeats`
- `actionHasDuration`
- `actionDateIsYesterday`
- `actionDateIsTomorrow`

**Impact**: Users think rules work but they don't

---

### HP-11: formatDate Function Duplicated 8 Times
**Category**: Code Redundancy
**Effort**: Quick fix
**Files**: Multiple OmniJS scripts

**Problem**: Same trivial function in 8+ scripts:
```javascript
function formatDate(date) {
  if (!date) return null;
  return date.toISOString();
}
```

**Solution**: Move to `lib/sharedUtils.js`

---

### HP-12: Temp File Cleanup Not Guaranteed
**Category**: Best Practices
**Effort**: Quick fix
**File**: `src/utils/scriptExecution.ts:176-182`

**Problem**:
```typescript
writeFileSync(tempFile, jxaScript);
const { stdout } = await execAsync(...);  // If this throws...
unlinkSync(tempFile);  // ...this never runs
```

**Solution**: Use try/finally:
```typescript
try {
  writeFileSync(tempFile, jxaScript);
  const { stdout } = await execAsync(...);
  return result;
} finally {
  try { unlinkSync(tempFile); } catch {}
}
```

---

### HP-13: Version Check Not Cached
**Category**: Performance
**Effort**: Moderate
**File**: `src/utils/perspectiveEngine.ts:130-179`

**Problem**: `checkVersionSupport()` executes JXA every call, no caching

**Solution**: Cache result after first call (version doesn't change during session)

---

### HP-14: Newline Escape Bug in Output
**Category**: Best Practices
**Effort**: Quick fix
**File**: `src/tools/primitives/getTodayCompletedTasks.ts:26-62`

**Problem**:
```typescript
let output = `# Tasks Completed Today\\n\\n`;  // Literal \n, not newline
```

**Impact**: Markdown formatting completely broken

---

### HP-15: Missing Type Definitions for Script Results
**Category**: Best Practices
**Effort**: Moderate
**Files**: All primitives

**Problem**: No TypeScript interfaces for what OmniJS scripts return

**Solution**: Define result interfaces for each script

---

## Medium Priority Issues

### MP-01: Unnecessary Array Copying Before Filtering
**File**: `omnifocusDump.js:50-67`
**Problem**: Creates 4 filtered arrays instead of inline filtering
**Solution**: Check status during iteration

### MP-02: Child Array Deduplication Uses .includes()
**File**: `omnifocusDump.js:142-145`
**Problem**: O(n) check per item in hierarchies
**Solution**: Use Set for tracking

### MP-03: Similar Logic in Perspective Scripts
**Files**: `inboxTasks.js`, `flaggedTasks.js`, `forecastTasks.js`, `tasksByTag.js`
**Problem**: ~50% code overlap
**Solution**: Create shared filter builder

### MP-04: Batch Handler Response Formatting Duplicated
**Files**: `batchAddItems.ts`, `batchEditItems.ts`, `batchRemoveItems.ts`
**Problem**: Same success/failure formatting
**Solution**: Create `formatBatchResults()` utility

### MP-05: Type Definitions Split Across Two Files
**Files**: `types.ts`, `omnifocustypes.ts`
**Problem**: Unclear separation of concerns
**Solution**: Consolidate to single file

### MP-06: Hardcoded "Daily Review" Perspective Logic
**File**: `perspectiveEngine.ts:280-294`
**Problem**: Business logic for specific perspective name
**Solution**: Use proper perspective configuration

### MP-07: Status Emoji Map Hardcoded
**File**: `filterTasks.ts:323-333`
**Problem**: Duplicate emojis, no documentation
**Solution**: Extract to constants with documentation

### MP-08: No Validation of Tag Existence
**File**: `addOmniFocusTask.ts`
**Problem**: Invalid tag names silently fail
**Solution**: Validate tags exist or will be created

### MP-09: AppleScript Text Item Delimiters (Legacy)
**File**: `applescriptUtils.ts:112-119`
**Problem**: Using archaic AppleScript patterns
**Solution**: Update to modern string handling

### MP-10: Excessive Type Constructor Calls
**File**: `dumpDatabase.ts:109-131`
**Problem**: Unnecessary `String()`, `Boolean()` wrappers
**Solution**: Trust TypeScript types

### MP-11: Parameter Validation Pattern Duplicated
**Files**: 8+ tool definitions
**Problem**: Same "id or name required" check
**Solution**: Create validation helper

### MP-12: No Result Size Limits
**File**: `scriptExecution.ts:189-193`
**Problem**: 50MB+ results could cause memory issues
**Solution**: Add size validation

### MP-13: Inefficient flatMap for Tag Checking
**File**: `perspectiveEngine.ts:584-592`
**Problem**: Converts tags to IDs then uses .includes()
**Solution**: Use Set for O(1) lookups

### MP-14: No Batch Processing in Forecast
**File**: `forecastTasks.js:65-134`
**Problem**: Processes all tasks in single pass
**Solution**: Add batch processing for large databases

### MP-15: Date Parsing Ignores Timezone
**File**: `perspectiveEngine.ts:556-560`
**Problem**: `new Date(task.deferDate)` loses timezone context
**Solution**: Use proper date library

### MP-16: Magic maxBuffer Value
**File**: `scriptExecution.ts:13`
**Problem**: 50MB with no explanation
**Solution**: Document why this value was chosen

### MP-17: Unused `extra` Parameter
**Files**: All handler functions
**Problem**: `RequestHandlerExtra` parameter never used
**Solution**: Remove or document intended use

### MP-18: Object Spreading in Parameter Passing
**File**: `filterTasks.ts:78-85`
**Problem**: Extra parameters silently passed to script
**Solution**: Explicitly list parameters

### MP-19: No Rate Limiting or Retry Logic
**Files**: All script execution
**Problem**: Transient failures cause permanent tool failure
**Solution**: Add retry with exponential backoff

### MP-20: Task/Project Info Formatting Duplicated
**Files**: `getTaskById.ts`, `getProjectById.ts`, `getFolderById.ts`
**Problem**: Similar markdown formatting logic
**Solution**: Create template-based formatter

---

## Low Priority Issues

### LP-01: `var` Keyword in Generated JXA
**File**: `perspectiveEngine.ts`
**Solution**: Use `const`/`let`

### LP-02: Inconsistent String Interpolation Style
**Files**: Multiple
**Solution**: Standardize with lint rules

### LP-03: Missing JSDoc on Public APIs
**Files**: All handlers
**Solution**: Add documentation comments

### LP-04: Inconsistent Interface Naming
**Pattern**: `AddOmniFocusTaskParams` vs `AddProjectParams`
**Solution**: Standardize naming convention

### LP-05: Missing Return Type Annotations
**Files**: Handler functions
**Solution**: Add explicit return types

### LP-06: Inconsistent Error Message Context
**Files**: Multiple primitives
**Solution**: Standardize error information included

### LP-07: No Comments on Complex Logic
**File**: `perspectiveEngine.ts:460-483`
**Solution**: Add explanatory comments

### LP-08: Temp File Naming Could Collide
**File**: `scriptExecution.ts:19`
**Solution**: Add random component to filename

### LP-09: No Execution Time Logging
**Problem**: Can't identify slow tools
**Solution**: Add timing instrumentation

### LP-10: Inconsistent Null Checking
**Files**: Multiple
**Solution**: Standardize null check patterns

### LP-11: Magic String "📥 Inbox"
**File**: `getFlaggedTasks.ts:52`
**Solution**: Extract to constant

### LP-12: Console.error for Non-errors
**Files**: `editItem.ts:70`, `removeItem.ts:37`
**Solution**: Use console.log for info messages

---

## Recommended Action Plan

### Phase 1: Quick Wins (1-2 days)
High impact, low effort fixes:

1. [ ] **CR-03**: Fix O(n²) tag deduplication with Set
2. [ ] **CR-04**: Cache tag lookups in batch operations
3. [ ] **CR-07**: Move status enum to sharedUtils.js
4. [ ] **CR-08**: Extract repetition rule schema
5. [ ] **HP-01**: Remove disabled dump_database code
6. [ ] **HP-02**: Delete unused yesterdayCompletedTasks.js
7. [ ] **HP-07**: Pre-compute timestamps for sorting
8. [ ] **HP-08**: Fix redundant Map.get() calls
9. [ ] **HP-11**: Move formatDate to sharedUtils.js
10. [ ] **HP-14**: Fix newline escape bug

### Phase 2: Error Handling (2-3 days)
Standardize error handling across codebase:

1. [ ] **CR-01**: Fix unsafe `as Error` casts (40+ files)
2. [ ] **CR-05**: Stop swallowing errors in script execution
3. [ ] **HP-06**: Create error response utility
4. [ ] **HP-12**: Add try/finally for temp file cleanup

### Phase 3: Code Consolidation (3-4 days)
Reduce duplication:

1. [ ] **CR-06**: Create parseScriptResult utility
2. [ ] **HP-04**: Remove/consolidate debug logging
3. [ ] **MP-04**: Create batch results formatter
4. [ ] **MP-11**: Create parameter validation helpers

### Phase 4: Type Safety (3-5 days)
Improve TypeScript usage:

1. [ ] **CR-02**: Replace `any` with proper interfaces
2. [ ] **CR-10**: Add input validation for dates/ranges
3. [ ] **HP-15**: Define script result interfaces
4. [ ] **MP-05**: Consolidate type definitions

### Phase 5: Performance Optimization (2-3 days)
Address remaining performance issues:

1. [ ] **CR-09**: Redesign parameter injection
2. [ ] **HP-05**: Convert to async file operations
3. [ ] **HP-09**: Add script execution timeout
4. [ ] **HP-13**: Cache version check result

### Phase 6: Cleanup & Polish (2-3 days)
Low priority improvements:

1. [ ] **HP-03**: Decide on V1 vs V2 perspective implementation
2. [ ] **HP-10**: Implement missing perspective rules
3. [ ] All Low Priority issues

---

## Estimated Total Effort

| Phase | Effort | Impact |
|-------|--------|--------|
| Phase 1: Quick Wins | 1-2 days | High |
| Phase 2: Error Handling | 2-3 days | High |
| Phase 3: Code Consolidation | 3-4 days | Medium |
| Phase 4: Type Safety | 3-5 days | High |
| Phase 5: Performance | 2-3 days | Medium |
| Phase 6: Cleanup | 2-3 days | Low |
| **Total** | **13-20 days** | - |

---

## Converting to Issues

Each item in this document can be converted to a GitHub issue using this template:

```markdown
## Description
[Copy the Problem description]

## Current Behavior
[Copy the code example showing the problem]

## Expected Behavior
[Copy the Solution]

## Files Affected
[List files]

## Labels
- priority: [critical/high/medium/low]
- effort: [quick-fix/moderate/significant]
- category: [performance/redundancy/best-practices/outdated-code]
```

---

*Generated by comprehensive codebase review - January 2026*
