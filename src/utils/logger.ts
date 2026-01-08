/**
 * Structured logging for OmniFocus MCP server
 * Writes to stderr to avoid corrupting the MCP JSON-RPC stream on stdout
 */

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

    // Write to stderr, NOT stdout (stdout is for MCP protocol)
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

  /**
   * Create a child logger with additional context
   * Useful for tracing logs to specific modules
   */
  child(subContext: string): Logger {
    const child = new Logger(`${this.context}:${subContext}`);
    child.level = this.level;
    return child;
  }
}

// Export singleton for general use
export const logger = new Logger();

// Export class for creating contextual loggers
export { Logger, LogLevel };
