# 004: Structured Logging to stderr

## Priority: Medium
## Effort: Low (1-2 hours)
## Category: Infrastructure Improvement

---

## Problem Statement

Current logging has several issues:

1. **Uses console.log/error inconsistently** - Some messages go to stdout, potentially corrupting MCP JSON stream
2. **No structured format** - Hard to parse or filter logs
3. **No log levels** - Can't adjust verbosity without code changes
4. **No context** - Hard to trace which operation caused a log message

---

## Proposed Solution

Create a simple logger class that:
1. Writes to stderr (not stdout - that's for MCP protocol)
2. Supports log levels (debug, info, warn, error)
3. Includes timestamp and context
4. Configurable via LOG_LEVEL environment variable

---

## Files to Create

### `src/utils/logger.ts`

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT'
};

class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string = 'of-mcp') {
    this.context = context;
    this.level = this.parseLevel(process.env.LOG_LEVEL || 'info');
  }

  private parseLevel(level: string): LogLevel {
    const normalized = level.toLowerCase();
    switch (normalized) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      case 'silent': return LogLevel.SILENT;
      default: return LogLevel.INFO;
    }
  }

  private write(level: LogLevel, message: string, data?: any): void {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];
    const line = `[${timestamp}] [${levelName}] [${this.context}] ${message}`;

    // Write to stderr, NOT stdout
    process.stderr.write(line + '\n');

    if (data !== undefined) {
      if (typeof data === 'object') {
        process.stderr.write(JSON.stringify(data, null, 2) + '\n');
      } else {
        process.stderr.write(String(data) + '\n');
      }
    }
  }

  debug(message: string, data?: any): void {
    this.write(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.write(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.write(LogLevel.WARN, message, data);
  }

  error(message: string, data?: any): void {
    this.write(LogLevel.ERROR, message, data);
  }

  // Create a child logger with additional context
  child(subContext: string): Logger {
    const child = new Logger(`${this.context}:${subContext}`);
    child.level = this.level;
    return child;
  }
}

// Export singleton for general use
export const logger = new Logger();

// Export class for creating contextual loggers
export { Logger };
```

---

## Files to Modify

### `src/utils/scriptExecution.ts`

Replace console.log/error with logger:

```typescript
import { logger } from './logger.js';

const log = logger.child('scriptExecution');

// Before
console.error("Script stderr output:", stderr);

// After
log.warn('Script stderr output', { stderr });

// Before
console.error("Failed to execute JXA script:", error);

// After
log.error('Failed to execute JXA script', { error: error.message, stack: error.stack });
```

### `src/server.ts`

Add startup logging:

```typescript
import { logger } from './utils/logger.js';

logger.info(`OmniFocus MCP server v${pkg.version} starting`);

// ... existing code ...

server.connect(transport).then(() => {
  logger.info('MCP server connected');
}).catch(err => {
  logger.error('Failed to start MCP server', { error: err.message });
});
```

---

## Implementation Notes

- CRITICAL: Never write to stdout - that's the MCP JSON-RPC stream
- Default log level should be 'info' for production use
- Debug level useful for troubleshooting but verbose
- Consider adding request ID tracking in future enhancement

---

## Acceptance Criteria

- [ ] `src/utils/logger.ts` created with Logger class
- [ ] Logger writes to stderr, not stdout
- [ ] Supports debug, info, warn, error levels
- [ ] LOG_LEVEL environment variable works
- [ ] scriptExecution.ts migrated to use logger
- [ ] server.ts startup logging added
- [ ] MCP protocol not corrupted by logging
- [ ] Version bump in package.json

---

## Testing

```bash
# Test default logging (info level)
npm start

# Test debug logging
LOG_LEVEL=debug npm start

# Test silent mode
LOG_LEVEL=silent npm start

# Verify stdout is clean JSON (MCP protocol)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm start 2>/dev/null
```

---

## References

- PERFORMANCE_AND_PATTERNS.md: "Logging Best Practices" section
- PERFORMANCE_AND_PATTERNS.md: "Structured Logging to stderr" subsection
