/**
 * Application Constants
 * General application-wide constants
 */

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Date Formats
export const DATE_FORMATS = {
  ISO: "YYYY-MM-DDTHH:mm:ss.SSSZ",
  DATE_ONLY: "YYYY-MM-DD",
  DISPLAY: "MMM DD, YYYY",
  DISPLAY_TIME: "MMM DD, YYYY HH:mm",
} as const;

// Transaction Types
export const TRANSACTION_TYPES = {
  DEBIT: "debit",
  CREDIT: "credit",
  REFUND: "refund",
  REVERSAL: "reversal",
} as const;

// Transaction Categories
export const TRANSACTION_CATEGORIES = {
  FOOD: "food",
  TRANSPORT: "transport",
  SHOPPING: "shopping",
  ENTERTAINMENT: "entertainment",
  BILLS: "bills",
  GROCERIES: "groceries",
  HEALTHCARE: "healthcare",
  EDUCATION: "education",
  TRAVEL: "travel",
  OTHER: "other",
} as const;

// Alert Types
export const ALERT_TYPES = {
  BUDGET_EXCEEDED: "budget_exceeded",
  LARGE_TRANSACTION: "large_transaction",
  UNUSUAL_ACTIVITY: "unusual_activity",
  BILL_DUE: "bill_due",
  SUBSCRIPTION_RENEWAL: "subscription_renewal",
} as const;

// Alert Priorities
export const ALERT_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

// Budget Periods
export const BUDGET_PERIODS = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

// Subscription Billing Cycles
export const BILLING_CYCLES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly",
} as const;

// Email Classifications
export const EMAIL_CLASSIFICATIONS = {
  TRANSACTION: "transaction",
  NOTIFICATION: "notification",
  PROMOTIONAL: "promotional",
  OTHER: "other",
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  MAX_REQUESTS_AUTH: 5, // For auth endpoints
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ["image/jpeg", "image/png", "application/pdf"],
} as const;

// Validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  CARD_NUMBER_LENGTH: 16,
  CVV_LENGTH: 3,
} as const;

export * from "./http-status.constants";
export * from "./error-messages.constants";
export * from "./routes.constants";
