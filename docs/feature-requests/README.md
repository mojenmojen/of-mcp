# Feature Requests

This folder contains prioritized feature requests for of-mcp improvements, derived from analyzing 6+ OmniFocus MCP implementations documented in [`../PERFORMANCE_AND_PATTERNS.md`](../PERFORMANCE_AND_PATTERNS.md).

## Implementation Order

Features are numbered in recommended implementation order, considering:
- **Dependencies** - Some features build on others
- **Impact** - User experience, reliability, performance
- **Effort** - Quick wins before deep refactors

---

## Quick Reference

### Pre-work (P0) - Complete First

| # | Feature | Priority | Effort | Category | Dependencies |
|---|---------|----------|--------|----------|--------------|
| P00A | [Execution Timeout](./P00A-execution-timeout.md) | Critical | Low | Reliability | - |
| P00B | [Remove Legacy Injection](./P00B-remove-legacy-injection.md) | Critical | Low | Cleanup | - |

### Main Features

| # | Feature | Priority | Effort | Category | Dependencies |
|---|---------|----------|--------|----------|--------------|
| 001 | [Diagnose Connection Tool](./001-diagnose-connection-tool.md) | High | Low | New Tool | - |
| 002 | [Structured Error Responses](./002-structured-error-responses.md) | High | Medium | Infrastructure | P00A, P00B |
| 003 | [Retry with Exponential Backoff](./003-retry-logic-exponential-backoff.md) | High | Medium | Infrastructure | 002 |
| 004 | [Structured Logging](./004-structured-logging.md) | Medium | Low | Infrastructure | - |
| 005 | [Get Available Tasks Tool](./005-get-available-tasks-tool.md) | Low | Low | Convenience | - |
| 006 | [Get Overdue Tasks Tool](./006-get-overdue-tasks-tool.md) | Low | Low | Convenience | - |
| 007 | [Search Tasks Tool](./007-search-tasks-tool.md) | Medium | Low | New Tool | - |
| 008 | [Cycle Detection in Batch Ops](./008-cycle-detection-batch-operations.md) | Medium | Medium | Data Integrity | 002-A |
| 009 | [Checksum Cache Invalidation](./009-checksum-cache-invalidation.md) | Medium | High | Performance | - |
| 010 | [Duplicate Project Tool](./010-duplicate-project-tool.md) | Low | Medium | New Tool | - |

**Priority Changes from Original:**
- 005, 006: Medium → Low (convenience wrappers, no performance benefit)
- 009: Low → Medium (biggest actual performance gain available)

---

## Suggested Implementation Phases

### Phase 0: Pre-work (Critical)

1. **P00A - Execution Timeout** - Prevents server hangs, required for error categorization
2. **P00B - Remove Legacy Injection** - Cleanup before modifying scriptExecution.ts

After Phase 0: Safe foundation for infrastructure changes.

### Phase 1: Foundation (Infrastructure)

1. **001 - Diagnose Connection Tool** - Immediate support value
2. **002-A - Structured Errors (Types)** - Create error types and factories
3. **002-B - Structured Errors (Core)** - Update scriptExecution.ts
4. **003 - Retry Logic** - Reliability improvement
5. **002-C - Structured Errors (Migration)** - Migrate tools incrementally

After Phase 1: Users get better error messages and more reliable connections.

### Phase 2: Developer Experience

6. **004 - Structured Logging** - Better debugging for developers

After Phase 2: Easier to debug issues in production.

### Phase 3: Performance & Data Integrity

7. **008 - Cycle Detection** - Prevent data corruption in batch ops
8. **009 - Checksum Caching** - Major performance gain for repeated queries

After Phase 3: Faster and safer operations.

### Phase 4: New Tools

9. **007 - Search Tasks** - Natural text search (most useful)
10. **005 - Get Available Tasks** - Convenience wrapper
11. **006 - Get Overdue Tasks** - Convenience wrapper
12. **010 - Duplicate Project** - Template workflows

After Phase 4: More intuitive tool surface for AI assistants.

**Note:** 005 and 006 were deprioritized because the `availableTasks()` API is JXA-only, not available in pure OmniJS. They provide no performance benefit over `filter_tasks`.

---

## What's Already Implemented

Based on the audit against PERFORMANCE_AND_PATTERNS.md, of-mcp already has:

- ✅ Temp file execution (avoids escaping issues)
- ✅ Large buffer (50MB) for big databases
- ✅ Shared utilities injection (parseLocalDate, buildRRule)
- ✅ Pure OmniJS scripts (not AppleScript-wrapped)
- ✅ Batch operations (9-12x faster)
- ✅ Task.Status enum usage
- ✅ Version from package.json (single source of truth)

---

## What's NOT Included (and why)

These patterns from PERFORMANCE_AND_PATTERNS.md were evaluated but not included:

| Pattern | Reason Not Included |
|---------|---------------------|
| URL scheme fallback | Fire-and-forget only, can't return results |
| safeGet function | of-mcp uses pure OmniJS, not JXA (safeGet is for JXA inconsistencies) |
| HTTP REST API | of-mcp is MCP-only by design |
| Natural language dates | OmniFocus handles this natively; would add complexity |
| Smart scheduling | Complex; better as separate feature set |

---

## Contributing

When implementing a feature:

1. Create a feature branch: `git checkout -b feature/XXX-feature-name`
2. Follow the implementation notes in the feature document
3. Update `README.md` (this file) if behavior changes
4. Bump version in `package.json`
5. Create PR and merge

---

## Converting to GitHub Issues

Once reviewed and approved, these documents can be converted to GitHub issues:

```bash
# Example using gh CLI
gh issue create \
  --title "001: Diagnose Connection Tool" \
  --body-file docs/feature-requests/001-diagnose-connection-tool.md \
  --label "enhancement"
```

Or manually create issues and link back to these documents for detailed specs.
