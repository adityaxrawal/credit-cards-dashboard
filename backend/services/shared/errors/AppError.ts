/**
 * Standard Error Codes for the Application
 */
export enum ErrorCode {
  // Validation Errors (400)
  E_VALIDATION = "E_VALIDATION",
  E_INVALID_INPUT = "E_INVALID_INPUT",
  E_MISSING_FIELD = "E_MISSING_FIELD",
  E_INVALID_FORMAT = "E_INVALID_FORMAT",

  // Authentication Errors (401)
  E_AUTH = "E_AUTH",
  E_UNAUTHORIZED = "E_UNAUTHORIZED",
  E_INVALID_TOKEN = "E_INVALID_TOKEN",
  E_TOKEN_EXPIRED = "E_TOKEN_EXPIRED",
  E_INVALID_CREDENTIALS = "E_INVALID_CREDENTIALS",

  // Authorization Errors (403)
  E_FORBIDDEN = "E_FORBIDDEN",
  E_INSUFFICIENT_PERMISSIONS = "E_INSUFFICIENT_PERMISSIONS",

  // Not Found Errors (404)
  E_NOT_FOUND = "E_NOT_FOUND",
  E_RESOURCE_NOT_FOUND = "E_RESOURCE_NOT_FOUND",

  // Conflict Errors (409)
  E_CONFLICT = "E_CONFLICT",
  E_DUPLICATE = "E_DUPLICATE",

  // Database Errors (500)
  E_DB_QUERY = "E_DB_QUERY",
  E_DB_CONNECTION = "E_DB_CONNECTION",
  E_DB_TRANSACTION = "E_DB_TRANSACTION",

  // External Service Errors (502, 503)
  E_EXTERNAL_SERVICE = "E_EXTERNAL_SERVICE",
  E_GMAIL_API = "E_GMAIL_API",
  E_SERVICE_UNAVAILABLE = "E_SERVICE_UNAVAILABLE",

  // Internal Server Errors (500)
  E_INTERNAL = "E_INTERNAL",
  E_SERVER_ERROR = "E_SERVER_ERROR",
  E_UNKNOWN = "E_UNKNOWN",

  // Business Logic Errors (422)
  E_BUSINESS_LOGIC = "E_BUSINESS_LOGIC",
  E_INVALID_STATE = "E_INVALID_STATE",
  E_OPERATION_FAILED = "E_OPERATION_FAILED",

  // Rate Limiting (429)
  E_RATE_LIMIT = "E_RATE_LIMIT",

  // File/Storage Errors (500)
  E_FILE_UPLOAD = "E_FILE_UPLOAD",
  E_FILE_DOWNLOAD = "E_FILE_DOWNLOAD",
  E_STORAGE = "E_STORAGE",
}

/**
 * Standard HTTP Status Codes
 */
export const ErrorStatusCode: Record<ErrorCode, number> = {
  [ErrorCode.E_VALIDATION]: 400,
  [ErrorCode.E_INVALID_INPUT]: 400,
  [ErrorCode.E_MISSING_FIELD]: 400,
  [ErrorCode.E_INVALID_FORMAT]: 400,

  [ErrorCode.E_AUTH]: 401,
  [ErrorCode.E_UNAUTHORIZED]: 401,
  [ErrorCode.E_INVALID_TOKEN]: 401,
  [ErrorCode.E_TOKEN_EXPIRED]: 401,
  [ErrorCode.E_INVALID_CREDENTIALS]: 401,

  [ErrorCode.E_FORBIDDEN]: 403,
  [ErrorCode.E_INSUFFICIENT_PERMISSIONS]: 403,

  [ErrorCode.E_NOT_FOUND]: 404,
  [ErrorCode.E_RESOURCE_NOT_FOUND]: 404,

  [ErrorCode.E_CONFLICT]: 409,
  [ErrorCode.E_DUPLICATE]: 409,

  [ErrorCode.E_DB_QUERY]: 500,
  [ErrorCode.E_DB_CONNECTION]: 500,
  [ErrorCode.E_DB_TRANSACTION]: 500,

  [ErrorCode.E_EXTERNAL_SERVICE]: 502,
  [ErrorCode.E_GMAIL_API]: 502,
  [ErrorCode.E_SERVICE_UNAVAILABLE]: 503,

  [ErrorCode.E_INTERNAL]: 500,
  [ErrorCode.E_SERVER_ERROR]: 500,
  [ErrorCode.E_UNKNOWN]: 500,

  [ErrorCode.E_BUSINESS_LOGIC]: 422,
  [ErrorCode.E_INVALID_STATE]: 422,
  [ErrorCode.E_OPERATION_FAILED]: 422,

  [ErrorCode.E_RATE_LIMIT]: 429,

  [ErrorCode.E_FILE_UPLOAD]: 500,
  [ErrorCode.E_FILE_DOWNLOAD]: 500,
  [ErrorCode.E_STORAGE]: 500,
};

/**
 * Application Error Class
 * Provides standardized error handling across all services
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, message: string, details?: any, isOperational: boolean = true) {
    super(message);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);

    this.name = "AppError";
    this.code = code;
    this.statusCode = ErrorStatusCode[code] || 500;
    this.details = details;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): {
    error: {
      code: string;
      message: string;
      statusCode: number;
      details?: any;
    };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        ...(this.details && { details: this.details }),
      },
    };
  }

  /**
   * Factory methods for common errors
   */
  static validation(message: string, details?: any): AppError {
    return new AppError(ErrorCode.E_VALIDATION, message, details);
  }

  static unauthorized(message: string = "Unauthorized access", details?: any): AppError {
    return new AppError(ErrorCode.E_UNAUTHORIZED, message, details);
  }

  static forbidden(message: string = "Forbidden", details?: any): AppError {
    return new AppError(ErrorCode.E_FORBIDDEN, message, details);
  }

  static notFound(resource: string, details?: any): AppError {
    return new AppError(ErrorCode.E_NOT_FOUND, `${resource} not found`, details);
  }

  static conflict(message: string, details?: any): AppError {
    return new AppError(ErrorCode.E_CONFLICT, message, details);
  }

  static database(message: string, details?: any): AppError {
    return new AppError(ErrorCode.E_DB_QUERY, message, details);
  }

  static externalService(service: string, message: string, details?: any): AppError {
    return new AppError(ErrorCode.E_EXTERNAL_SERVICE, `${service}: ${message}`, details);
  }

  static internal(message: string = "Internal server error", details?: any): AppError {
    return new AppError(ErrorCode.E_INTERNAL, message, details, false);
  }

  static businessLogic(message: string, details?: any): AppError {
    return new AppError(ErrorCode.E_BUSINESS_LOGIC, message, details);
  }

  static rateLimit(message: string = "Rate limit exceeded", details?: any): AppError {
    return new AppError(ErrorCode.E_RATE_LIMIT, message, details);
  }

  /**
   * Check if error is an AppError instance
   */
  static isAppError(error: any): error is AppError {
    return error instanceof AppError;
  }

  /**
   * Convert any error to AppError
   */
  static from(error: any, fallbackMessage: string = "An error occurred"): AppError {
    if (AppError.isAppError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(ErrorCode.E_INTERNAL, error.message || fallbackMessage, {
        originalError: error.message,
        stack: error.stack,
      });
    }

    return new AppError(ErrorCode.E_UNKNOWN, fallbackMessage, { originalError: String(error) });
  }
}

/**
 * Error Handler Middleware Helper
 * Can be used in Express middleware
 */
export function handleError(error: any): {
  statusCode: number;
  body: any;
} {
  if (AppError.isAppError(error)) {
    return {
      statusCode: error.statusCode,
      body: error.toJSON(),
    };
  }

  // Handle unknown errors
  const appError = AppError.from(error);
  return {
    statusCode: appError.statusCode,
    body: appError.toJSON(),
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(fn: (req: any, res: any, next: any) => Promise<any>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
