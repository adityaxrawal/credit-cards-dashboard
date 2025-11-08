import { logger } from "../../monitoring/logger";

/**
 * Gmail Sync Service - Structured error handling and service coordination
 * Provides standardized error codes and messages for Gmail sync operations
 */

export enum GmailSyncErrorCode {
  // Authentication/Authorization errors
  GMAIL_NOT_CONNECTED = "GMAIL_NOT_CONNECTED",
  GMAIL_TOKEN_EXPIRED = "GMAIL_TOKEN_EXPIRED",
  GMAIL_TOKEN_INVALID = "GMAIL_TOKEN_INVALID",
  GMAIL_PERMISSION_DENIED = "GMAIL_PERMISSION_DENIED",

  // API errors
  GMAIL_API_ERROR = "GMAIL_API_ERROR",
  GMAIL_RATE_LIMIT = "GMAIL_RATE_LIMIT",
  GMAIL_QUOTA_EXCEEDED = "GMAIL_QUOTA_EXCEEDED",

  // Data errors
  DATABASE_ERROR = "DATABASE_ERROR",
  TRANSACTION_EXTRACTION_FAILED = "TRANSACTION_EXTRACTION_FAILED",

  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",

  // Unknown errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class GmailSyncError extends Error {
  constructor(
    public code: GmailSyncErrorCode,
    message: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = "GmailSyncError";
  }
}

export interface GmailSyncResult {
  success: boolean;
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
  errorDetails?: Array<{
    code: string;
    message: string;
    emailId?: string;
  }>;
}

/**
 * Categorize Gmail API errors into structured error codes
 */
export function categorizeGmailError(error: any): GmailSyncError {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code;

  logger.error("Gmail error encountered", error instanceof Error ? error : undefined, {
    errorMessage,
    errorCode,
    errorType: error?.constructor?.name,
  });

  // Token/Auth errors
  if (
    errorMessage.includes("invalid_grant") ||
    errorMessage.includes("Token has been expired or revoked")
  ) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_TOKEN_EXPIRED,
      "Gmail access token has expired. Please reconnect your Gmail account.",
      401,
      false
    );
  }

  if (errorMessage.includes("invalid_client") || errorMessage.includes("unauthorized")) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_TOKEN_INVALID,
      "Invalid Gmail credentials. Please reconnect your Gmail account.",
      401,
      false
    );
  }

  if (errorMessage.includes("insufficient permissions")) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_PERMISSION_DENIED,
      "Insufficient Gmail permissions. Please grant required permissions.",
      403,
      false
    );
  }

  // Rate limiting
  if (errorCode === 429 || errorMessage.includes("rate limit")) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_RATE_LIMIT,
      "Gmail API rate limit exceeded. Please try again later.",
      429,
      true
    );
  }

  if (errorMessage.includes("quota exceeded")) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_QUOTA_EXCEEDED,
      "Gmail API quota exceeded. Please try again tomorrow.",
      429,
      false
    );
  }

  // Network errors
  if (
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("ETIMEDOUT")
  ) {
    return new GmailSyncError(
      GmailSyncErrorCode.NETWORK_ERROR,
      "Network error while connecting to Gmail. Please check your connection.",
      503,
      true
    );
  }

  if (errorMessage.includes("timeout")) {
    return new GmailSyncError(
      GmailSyncErrorCode.TIMEOUT_ERROR,
      "Gmail sync timed out. Please try again.",
      504,
      true
    );
  }

  // Database errors
  if (
    errorMessage.includes("database") ||
    errorMessage.includes("Supabase") ||
    errorMessage.includes("PostgreSQL")
  ) {
    return new GmailSyncError(
      GmailSyncErrorCode.DATABASE_ERROR,
      "Database error during sync. Please try again.",
      500,
      true
    );
  }

  // Gmail API general errors
  if (errorCode >= 400 && errorCode < 500) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_API_ERROR,
      `Gmail API error: ${errorMessage}`,
      errorCode,
      false
    );
  }

  if (errorCode >= 500) {
    return new GmailSyncError(
      GmailSyncErrorCode.GMAIL_API_ERROR,
      "Gmail service is temporarily unavailable. Please try again later.",
      503,
      true
    );
  }

  // Unknown error
  return new GmailSyncError(
    GmailSyncErrorCode.UNKNOWN_ERROR,
    errorMessage || "An unknown error occurred during Gmail sync",
    500,
    false,
    error
  );
}

/**
 * Log sync operation with structured data
 */
export function logSyncOperation(operation: string, userId: string, data: Record<string, any>) {
  logger.info(`Gmail sync: ${operation}`, {
    userId,
    operation,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Log sync error with structured data
 */
export function logSyncError(
  operation: string,
  userId: string,
  error: Error | GmailSyncError,
  data?: Record<string, any>
) {
  logger.error(`Gmail sync error: ${operation}`, error, {
    userId,
    operation,
    errorName: error.name,
    errorMessage: error.message,
    errorCode: error instanceof GmailSyncError ? error.code : "UNKNOWN",
    retryable: error instanceof GmailSyncError ? error.retryable : false,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * Create a standardized sync response
 */
export function createSyncResponse(result: Partial<GmailSyncResult>): GmailSyncResult {
  return {
    success: result.success ?? true,
    processed: result.processed ?? 0,
    inserted: result.inserted ?? 0,
    skipped: result.skipped ?? 0,
    errors: result.errors ?? 0,
    errorDetails: result.errorDetails,
  };
}

/**
 * Validate user has Gmail connected before sync
 */
export async function validateGmailConnection(
  userId: string,
  hasTokens: () => Promise<boolean>
): Promise<void> {
  const connected = await hasTokens();

  if (!connected) {
    throw new GmailSyncError(
      GmailSyncErrorCode.GMAIL_NOT_CONNECTED,
      "Gmail is not connected. Please connect your Gmail account first.",
      403,
      false
    );
  }
}
