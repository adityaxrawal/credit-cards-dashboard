import { NextResponse } from 'next/server';

// Custom API Error class
export class ApiError extends Error {
  public statusCode: number;
  public code?: string;

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

// Handle different types of errors and return standardized ApiError
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

// Error response helper
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

// Error response from ApiError instance
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

// Validation error helper
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

// Authentication error helper
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

// Rate limit error helper
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

// Generic API response wrapper for try-catch blocks
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

// Type definitions for API responses
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    field?: string;
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;