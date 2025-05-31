interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatMessage(level: string, message: string, context?: LogContext | Error): string {
    const timestamp = new Date().toISOString();
    let logMessage = `[${level}] ${timestamp}: ${message}`;
    
    if (context) {
      if (context instanceof Error) {
        logMessage += `\nError: ${context.message}`;
        if (context.stack) {
          logMessage += `\nStack: ${context.stack}`;
        }
      } else {
        logMessage += `\nContext: ${JSON.stringify(context, null, 2)}`;
      }
    }
    
    return logMessage;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('WARN', message, context));
  }

  error(message: string, context?: LogContext | Error): void {
    console.error(this.formatMessage('ERROR', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  // Performance logging
  time(label: string): void {
    console.time(`[PERF] ${label}`);
  }

  timeEnd(label: string): void {
    console.timeEnd(`[PERF] ${label}`);
  }

  // Structured logging for important events
  audit(event: string, details: LogContext): void {
    const auditLog = {
      timestamp: new Date().toISOString(),
      event,
      details,
      level: 'AUDIT'
    };
    console.log(JSON.stringify(auditLog));
  }
}

export const logger = new Logger();