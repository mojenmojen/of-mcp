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
| 002 | [Error Handling Consolidation](./002-structured-error-responses.md) | High | Medium | Infrastructure | P00A, P00B |
| 003 | [Retry with Exponential Backoff](./003-retry-logic-exponential-backoff.md) | High | Medium | Infrastructure | 002 |
| 004 | [Logging Cleanup](./004-structured-logging.md) | Medium | Low | Infrastructure | - |
| 007 | [Search Tasks Tool](./007-search-tasks-tool.md) | Medium | Low | New Tool | - |
| 008 | [Cycle Detection in Batch Ops](./008-cycle-detection-batch-operations.md) | Medium | Medium | Data Integrity | 002 |
| 009 | [Checksum Cache Invalidation](./009-checksum-cache-invalidation.md) | Medium | High | Performance | - |
| 010 | [Duplicate Project Tool](./010-duplicate-project-tool.md) | Low | Medium | New Tool | - |
| 011 | [Edit Tag Tool](./011-edit-tag-tool.md) | Medium | Medium | New Tool | - |

**Changes from Original Roadmap (January 2026 Review):**
- 002: Renamed "Structured Error Responses" → "Error Handling Consolidation" (Sprint 1 already fixed error swallowing; remaining work is CR-06 + HP-06)
- 004: Renamed "Structured Logging" → "Logging Cleanup" (aligns with HP-04: remove debug noise, add levels)
- 005, 006: **Removed** - `availableTasks()` API is JXA-only, provides no benefit over `filter_tasks`
- 009: Low → Medium priority (biggest actual performance gain available)

---

## Suggested Implementation Phases

### Phase 0: Pre-work (Critical)

1. **P00A - Execution Timeout** - Prevents server hangs, required for error categorization
2. **P00B - Remove Legacy Injection** - Cleanup before modifying scriptExecution.ts

After Phase 0: Safe foundation for infrastructure changes.

### Phase 1: Foundation (Infrastructure)

1. **001 - Diagnose Connection Tool** - Immediate support value
2. **002 - Error Handling Consolidation** - Create error utilities, consolidate JSON parsing boilerplate (CR-06, HP-06)
3. **003 - Retry Logic** - Reliability improvement with exponential backoff

After Phase 1: Users get better error messages and more reliable connections.

### Phase 2: Logging Cleanup

4. **004 - Logging Cleanup** - Remove debug noise, implement proper log levels (addresses HP-04)

After Phase 2: Cleaner output, easier debugging.

### Phase 3: Performance & Data Integrity

5. **008 - Cycle Detection** - Prevent data corruption in batch ops
6. **009 - Checksum Caching** - Major performance gain for repeated queries

After Phase 3: Faster and safer operations.

### Phase 4: New Tools

7. **007 - Search Tasks** - Natural text search (most useful)
8. **010 - Duplicate Project** - Template workflows
9. **011 - Edit Tag** - Tag status/rename/hierarchy management

After Phase 4: More intuitive tool surface for AI assistants.

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
