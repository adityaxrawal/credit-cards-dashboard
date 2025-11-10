/**
 * Sentry Configuration for Backend (API Gateway)
 *
 * Zero-cost monitoring using Sentry's free tier:
 * - 5,000 errors/month
 * - 10,000 performance units/month
 * - 1 user included
 *
 * Configured for distributed tracing across Gmail Sync, Reports, and Transactions APIs.
 */

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { logger } from "./logger";

/**
 * Initialize Sentry for backend
 * Only enabled if SENTRY_DSN_BACKEND is configured
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN_BACKEND;

  if (!dsn) {
    logger.warn("Sentry DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",

    // Enable tracing
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Enable profiling (optional, uses performance budget)
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    integrations: [
      // Performance monitoring
      nodeProfilingIntegration(),
    ],

    // Release tracking
    release: process.env.RENDER_GIT_COMMIT || "development",

    // Before send hook for filtering
    beforeSend(event, _hint) {
      // Don't send test errors
      if (process.env.NODE_ENV === "test") {
        return null;
      }

      // Filter out known harmless errors
      if (event.exception?.values?.[0]?.value?.includes("ECONNRESET")) {
        return null;
      }

      return event;
    },

    // Before breadcrumb hook
    beforeBreadcrumb(breadcrumb, _hint) {
      // Don't log sensitive data in breadcrumbs
      if (breadcrumb.category === "http") {
        delete breadcrumb.data?.["authorization"];
        delete breadcrumb.data?.["cookie"];
      }
      return breadcrumb;
    },
  });

  logger.info("✅ Sentry initialized successfully", {
    environment: process.env.NODE_ENV,
    release: process.env.RENDER_GIT_COMMIT || "development",
  });
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN_BACKEND) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture message with severity
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, unknown>
): void {
  if (process.env.SENTRY_DSN_BACKEND) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
}

/**
 * Start a new span for distributed tracing (Sentry v8 API)
 */
export function startSpan<T>(
  name: string,
  op: string,
  callback: () => T | Promise<T>
): T | Promise<T> {
  if (!process.env.SENTRY_DSN_BACKEND) {
    return callback();
  }

  return Sentry.startSpan(
    {
      name,
      op,
    },
    callback
  );
}

/**
 * Get the active span (for adding data)
 */
export function getActiveSpan() {
  if (!process.env.SENTRY_DSN_BACKEND) {
    return undefined;
  }
  return Sentry.getActiveSpan();
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  if (process.env.SENTRY_DSN_BACKEND) {
    Sentry.setUser(user);
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  if (process.env.SENTRY_DSN_BACKEND) {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = "info",
  data?: Record<string, unknown>
): void {
  if (process.env.SENTRY_DSN_BACKEND) {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}

/**
 * Flush pending events (useful before shutdown)
 */
export async function flushSentry(timeout: number = 2000): Promise<boolean> {
  if (process.env.SENTRY_DSN_BACKEND) {
    return await Sentry.flush(timeout);
  }
  return true;
}

// Export Sentry instance for advanced usage
export { Sentry };
