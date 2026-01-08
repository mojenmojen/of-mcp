# Feature Requests

This folder contains prioritized feature requests for of-mcp improvements, derived from analyzing 6+ OmniFocus MCP implementations documented in [`../PERFORMANCE_AND_PATTERNS.md`](../PERFORMANCE_AND_PATTERNS.md).

## Implementation Order

Features are numbered in recommended implementation order, considering:
- **Dependencies** - Some features build on others
- **Impact** - User experience, reliability, performance
- **Effort** - Quick wins before deep refactors

---

## Quick Reference

| # | Feature | Priority | Effort | Category | Dependencies |
|---|---------|----------|--------|----------|--------------|
| 001 | [Diagnose Connection Tool](./001-diagnose-connection-tool.md) | High | Low | New Tool | - |
| 002 | [Structured Error Responses](./002-structured-error-responses.md) | High | Medium | Infrastructure | - |
| 003 | [Retry with Exponential Backoff](./003-retry-logic-exponential-backoff.md) | High | Medium | Infrastructure | 002 |
| 004 | [Structured Logging](./004-structured-logging.md) | Medium | Low | Infrastructure | - |
| 005 | [Get Available Tasks Tool](./005-get-available-tasks-tool.md) | Medium | Low | New Tool | - |
| 006 | [Get Overdue Tasks Tool](./006-get-overdue-tasks-tool.md) | Medium | Low | New Tool | - |
| 007 | [Search Tasks Tool](./007-search-tasks-tool.md) | Medium | Low | New Tool | - |
| 008 | [Cycle Detection in Batch Ops](./008-cycle-detection-batch-operations.md) | Medium | Medium | Data Integrity | 002 |
| 009 | [Checksum Cache Invalidation](./009-checksum-cache-invalidation.md) | Low | High | Performance | - |
| 010 | [Duplicate Project Tool](./010-duplicate-project-tool.md) | Low | Medium | New Tool | - |

---

## Suggested Implementation Phases

### Phase 1: Foundation (Infrastructure)
_Estimated: 1-2 sessions_

1. **001 - Diagnose Connection Tool** - Immediate support value
2. **002 - Structured Error Responses** - Foundation for everything else
3. **003 - Retry Logic** - Reliability improvement

After Phase 1: Users get better error messages and more reliable connections.

### Phase 2: Developer Experience
_Estimated: 1 session_

4. **004 - Structured Logging** - Better debugging for developers

After Phase 2: Easier to debug issues in production.

### Phase 3: New Tools (Quick Wins)
_Estimated: 1-2 sessions_

5. **005 - Get Available Tasks** - Performance + convenience
6. **006 - Get Overdue Tasks** - Convenience
7. **007 - Search Tasks** - Natural text search

After Phase 3: More intuitive tool surface for AI assistants.

### Phase 4: Data Integrity
_Estimated: 1 session_

8. **008 - Cycle Detection** - Prevent data corruption

After Phase 4: Safer batch operations.

### Phase 5: Advanced (Optional)
_Estimated: 2+ sessions_

9. **009 - Checksum Caching** - Performance for repeated queries
10. **010 - Duplicate Project** - Template workflows

After Phase 5: Full feature parity with best implementations.

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
