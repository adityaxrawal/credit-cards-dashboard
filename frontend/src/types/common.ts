/**
 * Common types used across the application
 * Shared interfaces for API responses, pagination, and general utilities
 */

/**
 * Standard API response wrapper
 * @template T - The type of the data payload
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  timestamp: string;
}

/**
 * Paginated API response
 * @template T - The type of items in the data array
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * API error response
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}
