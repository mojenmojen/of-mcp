# OmniFocus MCP Server - Documentation

## Directory Structure

```
docs/
├── README.md                    # This file
├── WHATS_NEW.md                 # Summary for AI assistants (update on each release)
├── SPRINT_PROGRESS.md           # Sprint tracking and history
├── CODEBASE_REVIEW.md           # Technical review and analysis
├── PERFORMANCE_AND_PATTERNS.md  # Performance guide and patterns
├── reference/                   # Reference materials
│   └── applescript-class-reference.html
├── issues/                      # ACTIVE issues
│   ├── bugs/                    # Open bug reports
│   └── features/                # Feature requests
└── archive/                     # RESOLVED items
    ├── bugs/                    # Fixed bugs
    └── sprint-specs/            # Implemented feature specs
```

## Active Documentation

| File | Purpose |
|------|---------|
| [WHATS_NEW.md](WHATS_NEW.md) | Summary of recent changes for AI assistants |
| [SPRINT_PROGRESS.md](SPRINT_PROGRESS.md) | Development sprint history |
| [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) | Technical analysis and recommendations |
| [PERFORMANCE_AND_PATTERNS.md](PERFORMANCE_AND_PATTERNS.md) | Performance optimization patterns |

## Filing New Issues

### Bug Reports
Save to: `docs/issues/bugs/YYYY-MM-DD-short-description.md`

Template:
```markdown
# Bug: [Short Description]

**Date**: YYYY-MM-DD
**Severity**: High/Medium/Low
**Affected Tools**: tool_name

## Summary
Brief description of the bug.

## Steps to Reproduce
1. Step one
2. Step two

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Workaround
Any known workarounds.
```

### Feature Requests
Save to: `docs/issues/features/NNN-short-description.md`

Template:
```markdown
# Feature: [Short Description]

**Date**: YYYY-MM-DD
**Priority**: High/Medium/Low

## Summary
Brief description of the feature.

## Use Case
Why this feature is needed.

## Proposed Solution
How it should work.
```

## Archiving Resolved Issues

When an issue is resolved:
1. Move the file to `docs/archive/bugs/` or `docs/archive/sprint-specs/`
2. Add a note at the top: `**Resolved**: YYYY-MM-DD - [brief resolution note]`
