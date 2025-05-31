"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${level}] ${timestamp}: ${message}`;
        if (context) {
            if (context instanceof Error) {
                logMessage += `\nError: ${context.message}`;
                if (context.stack) {
                    logMessage += `\nStack: ${context.stack}`;
                }
            }
            else {
                logMessage += `\nContext: ${JSON.stringify(context, null, 2)}`;
            }
        }
        return logMessage;
    }
    info(message, context) {
        console.log(this.formatMessage('INFO', message, context));
    }
    warn(message, context) {
        console.warn(this.formatMessage('WARN', message, context));
    }
    error(message, context) {
        console.error(this.formatMessage('ERROR', message, context));
    }
    debug(message, context) {
        if (process.env.NODE_ENV === 'development') {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }
    // Performance logging
    time(label) {
        console.time(`[PERF] ${label}`);
    }
    timeEnd(label) {
        console.timeEnd(`[PERF] ${label}`);
    }
    // Structured logging for important events
    audit(event, details) {
        const auditLog = {
            timestamp: new Date().toISOString(),
            event,
            details,
            level: 'AUDIT'
        };
        console.log(JSON.stringify(auditLog));
    }
}
exports.logger = new Logger();
