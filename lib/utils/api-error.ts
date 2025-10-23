import { NextResponse } from 'next/server';

/**
 * Custom API Error class for standardized error handling
 * @class ApiError
 * @extends Error
 */
export class ApiError extends Error {
  /** HTTP status code for the error */
  public statusCode: number;
  /** Optional error code for categorization */
  public code?: string;

  /**
   * Creates a new ApiError instance
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} code - Optional error code for categorization
   * @example
   * ```typescript
   * throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
   * ```
   */
  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Handles different types of errors and returns standardized ApiError
 * @param {unknown} error - The error to handle (can be any type)
 * @returns {ApiError} Standardized ApiError instance
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   const apiError = handleApiError(err);
 *   return errorFromApiError(apiError);
 * }
 * ```
 */
export function handleApiError(error: unknown): ApiError {
  // If it's already an ApiError, return as is
  if (error instanceof ApiError) {
    return error;
  }

  // Handle Supabase errors
  if (error && typeof error === 'object' && 'message' in error) {
    const supabaseError = error as { message: string; code?: string; status?: number };
    
    // Common Supabase error codes
    switch (supabaseError.code) {
      case 'PGRST116':
        return new ApiError('Resource not found', 404, 'NOT_FOUND');
      case 'PGRST301':
        return new ApiError('Unauthorized access', 401, 'UNAUTHORIZED');
      case 'PGRST204':
        return new ApiError('Forbidden access', 403, 'FORBIDDEN');
      case '23505':
        return new ApiError('Resource already exists', 409, 'CONFLICT');
      case '23503':
        return new ApiError('Referenced resource not found', 400, 'INVALID_REFERENCE');
      case '42501':
        return new ApiError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      default:
        return new ApiError(
          supabaseError.message || 'Database operation failed',
          supabaseError.status || 500,
          supabaseError.code || 'DATABASE_ERROR'
        );
    }
  }

  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError('Network connection failed', 503, 'NETWORK_ERROR');
  }

  // Handle validation errors
  if (error instanceof SyntaxError) {
    return new ApiError('Invalid request format', 400, 'INVALID_FORMAT');
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return new ApiError(error.message, 500, 'INTERNAL_ERROR');
  }

  // Handle string errors
  if (typeof error === 'string') {
    return new ApiError(error, 500, 'UNKNOWN_ERROR');
  }

  // Fallback for unknown error types
  return new ApiError('An unexpected error occurred', 500, 'UNKNOWN_ERROR');
}

// Success response helper
/**
 * Creates a standardized success response
 * @template T - The type of data being returned
 * @param {T} data - The data to include in the response
 * @param {number} status - HTTP status code (default: 200)
 * @returns {NextResponse} Standardized success response
 * @example
 * ```typescript
 * return success({ users: [...] }, 200);
 * ```
 */
export function success<T>(data: T, status: number = 200): NextResponse<{
  success: true;
  data: T;
  timestamp: string;
}> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Creates a standardized error response
 * @param {string} message - Error message
 * @param {number} status - HTTP status code (default: 500)
 * @param {string} code - Optional error code
 * @returns {NextResponse} Standardized error response
 * @example
 * ```typescript
 * return error('User not found', 404, 'USER_NOT_FOUND');
 * ```
 */
export function error(
  message: string,
  status: number = 500,
  code?: string
): NextResponse<{
  success: false;
  error: {
    message: string;
    code?: string;
    timestamp: string;
  };
}> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Creates an error response from an ApiError instance
 * @param {ApiError} apiError - The ApiError instance to convert
 * @returns {NextResponse} Standardized error response
 * @example
 * ```typescript
 * const apiError = new ApiError('Not found', 404);
 * return errorFromApiError(apiError);
 * ```
 */
export function errorFromApiError(apiError: ApiError): NextResponse<{
  success: false;
  error: {
    message: string;
    code?: string;
    timestamp: string;
  };
}> {
  return error(apiError.message, apiError.statusCode, apiError.code);
}

/**
 * Creates a validation error response
 * @param {string} message - Validation error message
 * @param {string} field - Optional field name that failed validation
 * @returns {NextResponse} Standardized validation error response (400)
 * @example
 * ```typescript
 * return validationError('Email is required', 'email');
 * ```
 */
export function validationError(
  message: string,
  field?: string
): NextResponse<{
  success: false;
  error: {
    message: string;
    code: string;
    field?: string;
    timestamp: string;
  };
}> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'VALIDATION_ERROR',
        field,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 400 }
  );
}

/**
 * Creates an authentication error response
 * @param {string} message - Authentication error message (default: 'Authentication required')
 * @returns {NextResponse} Standardized authentication error response (401)
 * @example
 * ```typescript
 * return authError('Invalid token');
 * ```
 */
export function authError(
  message: string = 'Authentication required'
): NextResponse<{
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
  };
}> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString(),
      },
    },
    { status: 401 }
  );
}

/**
 * Creates a rate limit error response
 * @param {string} message - Rate limit error message (default: 'Too many requests')
 * @returns {NextResponse} Standardized rate limit error response (429)
 * @example
 * ```typescript
 * return rateLimitError('API rate limit exceeded');
 * ```
 */
export function rateLimitError(
  message: string = 'Too many requests'
): NextResponse<{
  success: false;
  error: {
    message: string;
    code: string;
    timestamp: string;
  };
}> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: 'RATE_LIMIT_ERROR',
        timestamp: new Date().toISOString(),
      },
    },
    { status: 429 }
  );
}

/**
 * Generic API response wrapper for try-catch blocks
 * Automatically handles errors and returns standardized responses
 * @template T - The type of data returned by the handler
 * @param {Function} handler - Async function that performs the API operation
 * @returns {Promise<NextResponse>} Standardized API response
 * @example
 * ```typescript
 * export async function GET() {
 *   return apiWrapper(async () => {
 *     const data = await fetchData();
 *     return { users: data };
 *   });
 * }
 * ```
 */
export async function apiWrapper<T>(
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await handler();
    return success(result);
  } catch (err) {
    const apiError = handleApiError(err);
    console.error('API Error:', {
      message: apiError.message,
      statusCode: apiError.statusCode,
      code: apiError.code,
      stack: apiError.stack,
    });
    return errorFromApiError(apiError);
  }
}

/**
 * Standard API success response format
 * @template T - The type of data being returned
 * @interface ApiSuccessResponse
 */
export interface ApiSuccessResponse<T> {
  /** Indicates successful response */
  success: true;
  /** The response data */
  data: T;
  /** ISO timestamp of the response */
  timestamp: string;
}

/**
 * Standard API error response format
 * @interface ApiErrorResponse
 */
export interface ApiErrorResponse {
  /** Indicates failed response */
  success: false;
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Optional error code for categorization */
    code?: string;
    /** Optional field name for validation errors */
    field?: string;
    /** ISO timestamp of the error */
    timestamp: string;
  };
}

/**
 * Union type for all possible API responses
 * @template T - The type of data returned on success
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;