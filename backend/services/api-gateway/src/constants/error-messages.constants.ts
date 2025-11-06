/**
 * Error Messages
 * Centralized error messages for consistent error handling
 */

export const ERROR_MESSAGES = {
  // Authentication & Authorization
  AUTH: {
    INVALID_CREDENTIALS: "Invalid email or password",
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "You don't have permission to access this resource",
    TOKEN_EXPIRED: "Authentication token has expired",
    TOKEN_INVALID: "Invalid authentication token",
    USER_NOT_FOUND: "User not found",
    EMAIL_ALREADY_EXISTS: "Email address already registered",
    WEAK_PASSWORD: "Password does not meet security requirements",
  },

  // Validation
  VALIDATION: {
    REQUIRED_FIELD: "This field is required",
    INVALID_EMAIL: "Invalid email address format",
    INVALID_DATE: "Invalid date format",
    INVALID_AMOUNT: "Invalid amount",
    INVALID_ID: "Invalid ID format",
    MIN_LENGTH: "Value is too short",
    MAX_LENGTH: "Value is too long",
  },

  // Cards
  CARDS: {
    NOT_FOUND: "Credit card not found",
    ALREADY_EXISTS: "Card with this number already exists",
    INVALID_NUMBER: "Invalid card number",
    INVALID_EXPIRY: "Invalid expiry date",
    CARD_EXPIRED: "This card has expired",
  },

  // Transactions
  TRANSACTIONS: {
    NOT_FOUND: "Transaction not found",
    INVALID_AMOUNT: "Invalid transaction amount",
    DUPLICATE: "Duplicate transaction detected",
    FAILED_TO_CREATE: "Failed to create transaction",
    FAILED_TO_UPDATE: "Failed to update transaction",
  },

  // Budgets
  BUDGETS: {
    NOT_FOUND: "Budget not found",
    ALREADY_EXISTS: "Budget already exists for this category",
    INVALID_AMOUNT: "Budget amount must be greater than zero",
    EXCEEDED: "Budget limit exceeded",
  },

  // Alerts
  ALERTS: {
    NOT_FOUND: "Alert not found",
    INVALID_THRESHOLD: "Invalid alert threshold",
    FAILED_TO_CREATE: "Failed to create alert",
  },

  // Gmail
  GMAIL: {
    NOT_CONNECTED: "Gmail account not connected",
    AUTH_FAILED: "Gmail authentication failed",
    INVALID_TOKEN: "Invalid Gmail token",
    TOKEN_EXPIRED: "Gmail token has expired",
    SYNC_FAILED: "Failed to sync Gmail messages",
    NO_EMAILS: "No emails found",
  },

  // Bills
  BILLS: {
    NOT_FOUND: "Bill not found",
    INVALID_DUE_DATE: "Invalid due date",
    ALREADY_PAID: "Bill is already marked as paid",
  },

  // Subscriptions
  SUBSCRIPTIONS: {
    NOT_FOUND: "Subscription not found",
    ALREADY_EXISTS: "Subscription already exists",
    INVALID_BILLING_CYCLE: "Invalid billing cycle",
  },

  // Rewards
  REWARDS: {
    NOT_FOUND: "Reward not found",
    INSUFFICIENT_POINTS: "Insufficient reward points",
    REDEMPTION_FAILED: "Failed to redeem reward",
  },

  // AI Insights
  AI_INSIGHTS: {
    GENERATION_FAILED: "Failed to generate AI insights",
    INSUFFICIENT_DATA: "Insufficient data for insights",
  },

  // Reports
  REPORTS: {
    GENERATION_FAILED: "Failed to generate report",
    INVALID_DATE_RANGE: "Invalid date range",
    EXPORT_FAILED: "Failed to export report",
  },

  // Generic
  GENERIC: {
    INTERNAL_ERROR: "An internal error occurred. Please try again later",
    NOT_FOUND: "Resource not found",
    BAD_REQUEST: "Invalid request",
    SERVICE_UNAVAILABLE: "Service temporarily unavailable",
    DATABASE_ERROR: "Database operation failed",
    NETWORK_ERROR: "Network error occurred",
  },
} as const;

export type ErrorMessage = string;
