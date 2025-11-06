/**
 * API Route Constants
 * Centralized route definitions
 */

export const API_PREFIX = "/api";

export const ROUTES = {
  AUTH: {
    BASE: "/auth",
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    PROFILE: "/auth/profile",
  },

  CARDS: {
    BASE: "/cards",
    BY_ID: "/cards/:id",
    TRANSACTIONS: "/cards/:id/transactions",
  },

  TRANSACTIONS: {
    BASE: "/transactions",
    BY_ID: "/transactions/:id",
    BULK: "/transactions/bulk",
    RECONCILE: "/transactions/reconcile",
  },

  BUDGETS: {
    BASE: "/budgets",
    BY_ID: "/budgets/:id",
    SUMMARY: "/budgets/summary",
    ALERTS: "/budgets/alerts",
  },

  ALERTS: {
    BASE: "/alerts",
    BY_ID: "/alerts/:id",
    MARK_READ: "/alerts/:id/read",
    BULK_READ: "/alerts/bulk-read",
  },

  ANALYTICS: {
    BASE: "/analytics",
    DASHBOARD: "/analytics/dashboard",
    SPENDING: "/analytics/spending",
    TRENDS: "/analytics/trends",
  },

  GMAIL: {
    BASE: "/gmail",
    AUTH_URL: "/gmail/auth-url",
    CONNECT: "/gmail/connect",
    DISCONNECT: "/gmail/disconnect",
    STATUS: "/gmail/status",
    SYNC: "/gmail/sync",
  },

  BILLS: {
    BASE: "/bills",
    BY_ID: "/bills/:id",
    UPCOMING: "/bills/upcoming",
    OVERDUE: "/bills/overdue",
    PAY: "/bills/:id/pay",
  },

  SUBSCRIPTIONS: {
    BASE: "/subscriptions",
    BY_ID: "/subscriptions/:id",
    RECURRING: "/subscriptions/recurring",
    DETECT: "/subscriptions/detect",
  },

  REWARDS: {
    BASE: "/rewards",
    BY_ID: "/rewards/:id",
    BALANCE: "/rewards/balance",
    REDEEM: "/rewards/redeem",
  },

  AI_INSIGHTS: {
    BASE: "/ai-insights",
    GENERATE: "/ai-insights/generate",
    RECOMMENDATIONS: "/ai-insights/recommendations",
  },

  REPORTS: {
    BASE: "/reports",
    GENERATE: "/reports/generate",
    EXPORT: "/reports/export",
    SCHEDULED: "/reports/scheduled",
  },

  HEALTH: {
    BASE: "/health",
    READY: "/health/ready",
    LIVE: "/health/live",
  },
} as const;

export type Route = string;
