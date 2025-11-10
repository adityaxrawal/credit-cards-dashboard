/**
 * Query Helper Utility Module
 * Database query helpers and error handling
 */

import { logger } from "../monitoring/logger";
import { AppError, ErrorCode } from "../errors/AppError";

/**
 * Handle database errors and convert to AppError
 */
export function handleDatabaseError(error: unknown, operation: string): never {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logger.error(`Database error during ${operation}:`, errorObj);

  if (error instanceof Error) {
    // PostgreSQL error codes
    const pgError = error as Error & { code?: string };

    // Unique constraint violation
    if (pgError.code === "23505") {
      throw new AppError(ErrorCode.E_DUPLICATE, "Resource already exists");
    }

    // Foreign key violation
    if (pgError.code === "23503") {
      throw new AppError(ErrorCode.E_RESOURCE_NOT_FOUND, "Referenced resource not found");
    }

    // Not null violation
    if (pgError.code === "23502") {
      throw new AppError(ErrorCode.E_MISSING_FIELD, "Required field is missing");
    }

    // Check violation
    if (pgError.code === "23514") {
      throw new AppError(ErrorCode.E_VALIDATION, "Invalid data: constraint violation");
    }

    // Connection errors
    if (pgError.code === "ECONNREFUSED" || pgError.code === "ETIMEDOUT") {
      throw new AppError(ErrorCode.E_DB_CONNECTION, "Database connection failed");
    }
  }

  // Generic database error
  throw new AppError(ErrorCode.E_DB_QUERY, `Database operation failed: ${operation}`);
}

/**
 * Safely execute database query with error handling
 */
export async function safeQuery<T>(operation: string, queryFn: () => Promise<T>): Promise<T> {
  try {
    return await queryFn();
  } catch (error) {
    handleDatabaseError(error, operation);
  }
}

/**
 * Build pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function buildPaginationParams(
  page?: number | string,
  limit?: number | string
): PaginationParams {
  const parsedPage = Math.max(1, parseInt(String(page || "1"), 10));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit || "20"), 10)));

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset: (parsedPage - 1) * parsedLimit,
  };
}

/**
 * Build pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  totalPages: number;
  totalRecords: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  totalRecords: number
): PaginationMeta {
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    page,
    limit,
    totalPages,
    totalRecords,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Build date range filter
 */
export interface DateRangeFilter {
  startDate: Date;
  endDate: Date;
}

export function buildDateRangeFilter(
  startDate?: string | Date,
  endDate?: string | Date
): DateRangeFilter {
  const now = new Date();

  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month

  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month

  // Validate range
  if (start > end) {
    throw new AppError(
      ErrorCode.E_INVALID_INPUT,
      "Invalid date range: start date must be before end date"
    );
  }

  return { startDate: start, endDate: end };
}

/**
 * Build ORDER BY clause from sort params
 */
export interface SortParams {
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function buildSortParams(
  sortBy?: string,
  sortOrder?: string,
  allowedFields: string[] = []
): SortParams {
  const normalizedSortBy = (sortBy || "created_at").toLowerCase();
  const normalizedSortOrder = (sortOrder || "desc").toLowerCase() as "asc" | "desc";

  // Validate sort field if allowed fields provided
  if (allowedFields.length > 0 && !allowedFields.includes(normalizedSortBy)) {
    throw new AppError(ErrorCode.E_INVALID_INPUT, `Invalid sort field: ${sortBy}`);
  }

  // Validate sort order
  if (!["asc", "desc"].includes(normalizedSortOrder)) {
    throw new AppError(ErrorCode.E_INVALID_INPUT, `Invalid sort order: ${sortOrder}`);
  }

  return {
    sortBy: normalizedSortBy,
    sortOrder: normalizedSortOrder,
  };
}

/**
 * Escape special characters in LIKE queries
 */
export function escapeLikeQuery(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

/**
 * Build LIKE pattern for search
 */
export function buildLikePattern(
  value: string,
  position: "start" | "end" | "both" = "both"
): string {
  const escaped = escapeLikeQuery(value);

  switch (position) {
    case "start":
      return `${escaped}%`;
    case "end":
      return `%${escaped}`;
    case "both":
    default:
      return `%${escaped}%`;
  }
}

/**
 * Check if result is empty
 */
export function isEmptyResult(result: unknown): boolean {
  return (
    result === null ||
    result === undefined ||
    (Array.isArray(result) && result.length === 0) ||
    (typeof result === "object" && Object.keys(result as object).length === 0)
  );
}

/**
 * Validate required fields in result
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[],
  resourceName = "Resource"
): void {
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new AppError(
      ErrorCode.E_MISSING_FIELD,
      `${resourceName} is missing required fields: ${missingFields.join(", ")}`
    );
  }
}

/**
 * Build WHERE IN clause safely
 */
export function buildInClause(
  field: string,
  values: unknown[]
): { clause: string; values: unknown[] } {
  if (!values || values.length === 0) {
    return { clause: "1=1", values: [] };
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  return {
    clause: `${field} IN (${placeholders})`,
    values,
  };
}

/**
 * Calculate billing cycle month and year
 */
export function calculateBillingCycle(
  transactionDate: Date,
  billDate: number
): { month: number; year: number } {
  const txDate = new Date(transactionDate);
  const txDay = txDate.getDate();
  let month = txDate.getMonth() + 1; // 1-12
  let year = txDate.getFullYear();

  // If transaction is before bill date, it belongs to previous billing cycle
  if (txDay < billDate) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return { month, year };
}

/**
 * Calculate days until a specific day of month
 */
export function daysUntilDayOfMonth(dayOfMonth: number): number {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);

  // If target day has passed this month, calculate for next month
  if (targetDate < today) {
    targetDate.setMonth(targetDate.getMonth() + 1);
  }

  const diffMs = targetDate.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
