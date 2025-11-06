"use strict";
/**
 * Centralized Logging Service
 * Phase 6: Post-Launch & Optimization
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.LogLevel = void 0;
exports.createLogger = createLogger;
const winston_1 = __importDefault(require("winston"));
const sentry_config_1 = require("./sentry-config");
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor(service) {
        this.defaultContext = { service };
        // Create Winston logger
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || "info",
            format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json()),
            defaultMeta: this.defaultContext,
            transports: [
                // Console transport
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
                        const metaStr = Object.keys(meta).length
                            ? JSON.stringify(meta, null, 2)
                            : "";
                        return `${timestamp} [${level}]: ${message} ${metaStr}`;
                    })),
                }),
                // File transport for errors
                new winston_1.default.transports.File({
                    filename: "logs/error.log",
                    level: "error",
                    maxsize: 5242880, // 5MB
                    maxFiles: 5,
                }),
                // File transport for all logs
                new winston_1.default.transports.File({
                    filename: "logs/combined.log",
                    maxsize: 5242880, // 5MB
                    maxFiles: 10,
                }),
            ],
        });
        // Add production transports
        if (process.env.NODE_ENV === "production") {
            // You can add cloud logging here (e.g., Google Cloud Logging, CloudWatch)
            this.logger.add(new winston_1.default.transports.File({
                filename: "logs/production.log",
                level: "info",
                maxsize: 10485760, // 10MB
                maxFiles: 20,
            }));
        }
    }
    /**
     * Log an error
     */
    error(message, error, context) {
        const logContext = { ...this.defaultContext, ...context };
        if (error) {
            this.logger.error(message, {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                },
                ...logContext,
            });
            // Send to Sentry
            (0, sentry_config_1.captureError)(error, logContext);
        }
        else {
            this.logger.error(message, logContext);
            (0, sentry_config_1.captureMessage)(message, "error", logContext);
        }
    }
    /**
     * Log a warning
     */
    warn(message, context) {
        const logContext = { ...this.defaultContext, ...context };
        this.logger.warn(message, logContext);
        if (process.env.NODE_ENV === "production") {
            (0, sentry_config_1.captureMessage)(message, "warning", logContext);
        }
    }
    /**
     * Log an info message
     */
    info(message, context) {
        const logContext = { ...this.defaultContext, ...context };
        this.logger.info(message, logContext);
    }
    /**
     * Log a debug message
     */
    debug(message, context) {
        const logContext = { ...this.defaultContext, ...context };
        this.logger.debug(message, logContext);
    }
    /**
     * Log HTTP request
     */
    logRequest(method, path, statusCode, duration, context) {
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
        const message = `${method} ${path} ${statusCode} - ${duration}ms`;
        this.logger.log(level, message, {
            ...this.defaultContext,
            ...context,
            http: {
                method,
                path,
                statusCode,
                duration,
            },
        });
    }
    /**
     * Log database query
     */
    logQuery(query, duration, success, context) {
        this.logger.debug("Database query", {
            ...this.defaultContext,
            ...context,
            query: {
                sql: query.substring(0, 200), // Truncate long queries
                duration,
                success,
            },
        });
    }
    /**
     * Create child logger with additional context
     */
    child(context) {
        const childLogger = new Logger(this.defaultContext.service);
        childLogger.defaultContext = { ...this.defaultContext, ...context };
        return childLogger;
    }
}
// Export factory function
function createLogger(service) {
    return new Logger(service);
}
// Default logger instance
exports.logger = createLogger("credit-card-dashboard");
//# sourceMappingURL=logger.js.map