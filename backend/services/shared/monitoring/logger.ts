/**
 * Centralized Logging Service
 * Phase 6: Post-Launch & Optimization
 */

import winston from "winston";
import { captureError, captureMessage } from "./sentry-config";

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export interface LogContext {
  service: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private logger: winston.Logger;
  private defaultContext: LogContext;

  constructor(service: string) {
    this.defaultContext = { service };

    // Create Winston logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: this.defaultContext,
      transports: [
        // Console transport (always on)
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
              return `${timestamp} [${level}]: ${message} ${metaStr}`;
            })
          ),
        }),
      ],
    });

    // Optional file logging controlled by ENABLE_FILE_LOGGING env flag
    if (process.env.ENABLE_FILE_LOGGING === "true") {
      this.logger.add(
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          maxsize: 5242880,
          maxFiles: 5,
        })
      );
      this.logger.add(
        new winston.transports.File({
          filename: "logs/combined.log",
          maxsize: 5242880,
          maxFiles: 10,
        })
      );
    }

    // Add production transports
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_FILE_LOGGING === "true") {
      // Optional production aggregated log
      this.logger.add(
        new winston.transports.File({
          filename: "logs/production.log",
          level: "info",
          maxsize: 10485760,
          maxFiles: 20,
        })
      );
    }
  }

  /**
   * Log an error
   */
  error(message: string, error?: Error, context?: Partial<LogContext>): void {
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
      captureError(error, logContext);
    } else {
      this.logger.error(message, logContext);
      captureMessage(message, "error", logContext);
    }
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: Partial<LogContext>): void {
    const logContext = { ...this.defaultContext, ...context };
    this.logger.warn(message, logContext);

    if (process.env.NODE_ENV === "production") {
      captureMessage(message, "warning", logContext);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Partial<LogContext>): void {
    const logContext = { ...this.defaultContext, ...context };
    this.logger.info(message, logContext);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Partial<LogContext>): void {
    const logContext = { ...this.defaultContext, ...context };
    this.logger.debug(message, logContext);
  }

  /**
   * Log HTTP request
   */
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: Partial<LogContext>
  ): void {
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
  logQuery(query: string, duration: number, success: boolean, context?: Partial<LogContext>): void {
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
  child(context: Partial<LogContext>): Logger {
    const childLogger = new Logger(this.defaultContext.service);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    return childLogger;
  }
}

// Export factory function
export function createLogger(service: string): Logger {
  return new Logger(service);
}

// Default logger instance
export const logger = createLogger("credit-card-dashboard");
