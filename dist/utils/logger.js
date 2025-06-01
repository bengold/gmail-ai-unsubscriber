"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (LogLevel = {}));
class Logger {
    constructor() {
        this.useColors = true;
        this.compactMode = true;
        // Set log level based on environment
        const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
        this.logLevel = LogLevel[envLogLevel] ??
            (process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
        // Disable colors in production
        this.useColors = process.env.NODE_ENV !== 'production';
        // Use compact mode by default
        this.compactMode = process.env.LOG_COMPACT !== 'false';
    }
    shouldLog(level) {
        return level <= this.logLevel;
    }
    formatMessage(level, message, context) {
        if (this.compactMode) {
            // Compact format for cleaner output
            const time = new Date().toLocaleTimeString();
            let prefix = '';
            if (this.useColors) {
                const colors = {
                    ERROR: '\x1b[31m', // Red
                    WARN: '\x1b[33m', // Yellow
                    INFO: '\x1b[36m', // Cyan
                    DEBUG: '\x1b[90m', // Gray
                    TRACE: '\x1b[90m', // Gray
                    AUDIT: '\x1b[35m', // Magenta
                    PERF: '\x1b[32m' // Green
                };
                const reset = '\x1b[0m';
                prefix = `${colors[level] || ''}[${level.padEnd(5)}]${reset} ${time} |`;
            }
            else {
                prefix = `[${level.padEnd(5)}] ${time} |`;
            }
            let logMessage = `${prefix} ${message}`;
            if (context) {
                if (context instanceof Error) {
                    logMessage += ` - ${context.message}`;
                    if (this.logLevel >= LogLevel.DEBUG && context.stack) {
                        logMessage += `\n${context.stack}`;
                    }
                }
                else if (Object.keys(context).length > 0) {
                    // Only show context in debug mode
                    if (this.logLevel >= LogLevel.DEBUG) {
                        logMessage += ` ${JSON.stringify(context)}`;
                    }
                }
            }
            return logMessage;
        }
        else {
            // Original verbose format
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
    }
    info(message, context) {
        if (this.shouldLog(LogLevel.INFO)) {
            console.log(this.formatMessage('INFO', message, context));
        }
    }
    warn(message, context) {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message, context));
        }
    }
    error(message, context) {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatMessage('ERROR', message, context));
        }
    }
    debug(message, context) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }
    trace(message, context) {
        if (this.shouldLog(LogLevel.TRACE)) {
            console.debug(this.formatMessage('TRACE', message, context));
        }
    }
    // Performance logging
    time(label) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.time(`[PERF] ${label}`);
        }
    }
    timeEnd(label) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.timeEnd(`[PERF] ${label}`);
        }
    }
    // Structured logging for important events
    audit(event, details) {
        if (this.shouldLog(LogLevel.INFO)) {
            if (this.compactMode) {
                console.log(this.formatMessage('AUDIT', event, details));
            }
            else {
                const auditLog = {
                    timestamp: new Date().toISOString(),
                    event,
                    details,
                    level: 'AUDIT'
                };
                console.log(JSON.stringify(auditLog));
            }
        }
    }
    // Progress indicator for long operations
    progress(message) {
        if (this.shouldLog(LogLevel.INFO)) {
            process.stdout.write(`\r${message}`);
        }
    }
    // Clear the current line
    clearLine() {
        if (this.shouldLog(LogLevel.INFO)) {
            process.stdout.clearLine?.(0);
            process.stdout.cursorTo?.(0);
        }
    }
}
exports.logger = new Logger();
