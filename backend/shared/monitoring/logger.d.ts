/**
 * Centralized Logging Service
 * Phase 6: Post-Launch & Optimization
 */
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug"
}
export interface LogContext {
    service: string;
    userId?: string;
    requestId?: string;
    [key: string]: any;
}
declare class Logger {
    private logger;
    private defaultContext;
    constructor(service: string);
    /**
     * Log an error
     */
    error(message: string, error?: Error, context?: Partial<LogContext>): void;
    /**
     * Log a warning
     */
    warn(message: string, context?: Partial<LogContext>): void;
    /**
     * Log an info message
     */
    info(message: string, context?: Partial<LogContext>): void;
    /**
     * Log a debug message
     */
    debug(message: string, context?: Partial<LogContext>): void;
    /**
     * Log HTTP request
     */
    logRequest(method: string, path: string, statusCode: number, duration: number, context?: Partial<LogContext>): void;
    /**
     * Log database query
     */
    logQuery(query: string, duration: number, success: boolean, context?: Partial<LogContext>): void;
    /**
     * Create child logger with additional context
     */
    child(context: Partial<LogContext>): Logger;
}
export declare function createLogger(service: string): Logger;
export declare const logger: Logger;
export {};
