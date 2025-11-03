/**
 * Error handling utilities for the application
 */

export interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
  context?: Record<string, unknown>;
}

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code = "APP_ERROR",
    statusCode?: number,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);

    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, AppError);
  }
}

/**
 * API Error class for handling API-specific errors
 */
export class ApiError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    code = "API_ERROR",
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, true, context);
    this.name = "ApiError";
  }
}

/**
 * Validation Error class for form validation errors
 */
export class ValidationError extends AppError {
  public readonly fields: Record<string, string>;

  constructor(
    message: string,
    fields: Record<string, string> = {},
    context?: Record<string, unknown>
  ) {
    super(message, "VALIDATION_ERROR", 400, true, context);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/**
 * Network Error class for network-related issues
 */
export class NetworkError extends AppError {
  constructor(
    message = "Network error occurred",
    context?: Record<string, unknown>
  ) {
    super(message, "NETWORK_ERROR", 0, true, context);
    this.name = "NetworkError";
  }
}

/**
 * Error logger utility
 */
class ErrorLogger {
  private logs: ErrorLog[] = [];
  private maxLogs = 100;

  /**
   * Log an error with context
   */
  log(error: Error, context?: Record<string, unknown>): void {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "server",
      userAgent: typeof window !== "undefined" ? navigator.userAgent : "server",
      context,
    };

    this.logs.unshift(errorLog);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error logged:", errorLog);
    }

    // In production, send to error reporting service
    if (process.env.NODE_ENV === "production") {
      this.sendToErrorService(errorLog);
    }
  }

  /**
   * Get recent error logs
   */
  getLogs(): ErrorLog[] {
    return [...this.logs];
  }

  /**
   * Clear error logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Generate unique ID for error log
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Send error to external error reporting service
   */
  private async sendToErrorService(errorLog: ErrorLog): Promise<void> {
    try {
      // Example implementation - replace with your actual error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorLog),
      // });

      console.log("Error would be sent to error service:", errorLog);
    } catch (error) {
      console.warn("Failed to send error to reporting service:", error);
    }
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

/**
 * Error handler utility functions
 */
export const ErrorHandlers = {
  /**
   * Handle and log an error
   */
  handle(error: unknown, context?: Record<string, unknown>): AppError {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      appError = new AppError(error.message, "UNKNOWN_ERROR", undefined, false);
    } else {
      appError = new AppError(
        "An unknown error occurred",
        "UNKNOWN_ERROR",
        undefined,
        false
      );
    }

    // Log the error
    errorLogger.log(appError, context);

    return appError;
  },

  /**
   * Handle API errors
   */
  handleApiError(error: unknown, context?: Record<string, unknown>): ApiError {
    let apiError: ApiError;

    if (error instanceof ApiError) {
      apiError = error;
    } else if (error instanceof Error) {
      // Try to extract status code from error message or other properties
      const statusCode = this.extractStatusCode(error);
      apiError = new ApiError(error.message, statusCode);
    } else {
      apiError = new ApiError("API request failed", 500);
    }

    errorLogger.log(apiError, context);
    return apiError;
  },

  /**
   * Handle validation errors
   */
  handleValidationError(
    fields: Record<string, string>,
    message = "Validation failed"
  ): ValidationError {
    const error = new ValidationError(message, fields);
    errorLogger.log(error);
    return error;
  },

  /**
   * Handle network errors
   */
  handleNetworkError(
    error: unknown,
    context?: Record<string, unknown>
  ): NetworkError {
    const message =
      error instanceof Error ? error.message : "Network error occurred";
    const networkError = new NetworkError(message, context);
    errorLogger.log(networkError, context);
    return networkError;
  },

  /**
   * Extract status code from error object
   */
  extractStatusCode(error: unknown): number {
    if (typeof error === "object" && error !== null) {
      const errorObj = error as Record<string, unknown>;

      if (typeof errorObj.status === "number") return errorObj.status;
      if (typeof errorObj.statusCode === "number") return errorObj.statusCode;
      if (typeof errorObj.code === "number") return errorObj.code;
    }

    return 500; // Default to server error
  },

  /**
   * Format error for display to user
   */
  formatForUser(error: unknown): string {
    if (error instanceof ValidationError) {
      const fieldErrors = Object.values(error.fields).join(", ");
      return fieldErrors || error.message;
    }

    if (error instanceof ApiError) {
      switch (error.statusCode) {
        case 400:
          return "Invalid request. Please check your input and try again.";
        case 401:
          return "Authentication required. Please sign in and try again.";
        case 403:
          return "Access denied. You don't have permission to perform this action.";
        case 404:
          return "The requested resource was not found.";
        case 429:
          return "Too many requests. Please wait a moment and try again.";
        case 500:
          return "Server error. Please try again later.";
        default:
          return error.message || "An error occurred. Please try again.";
      }
    }

    if (error instanceof NetworkError) {
      return "Network connection failed. Please check your internet connection.";
    }

    if (error instanceof AppError && error.isOperational) {
      return error.message;
    }

    // Generic fallback for unknown errors
    return "An unexpected error occurred. Please try again.";
  },
};

/**
 * React hook for error handling
 */
export function useErrorHandler() {
  const handleError = (error: unknown, context?: Record<string, unknown>) => {
    return ErrorHandlers.handle(error, context);
  };

  const handleApiError = (
    error: unknown,
    context?: Record<string, unknown>
  ) => {
    return ErrorHandlers.handleApiError(error, context);
  };

  const formatError = (error: unknown) => {
    return ErrorHandlers.formatForUser(error);
  };

  return {
    handleError,
    handleApiError,
    formatError,
    errorLogger,
  };
}
