/**
 * Sentry Client Configuration for Next.js Frontend
 *
 * Provides error tracking and performance monitoring for the browser
 */

import * as Sentry from "@sentry/nextjs";

let initialized = false;

/**
 * Initialize Sentry for client-side error tracking
 */
export function initSentry(): void {
  if (initialized || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",

    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session Replay (disable for zero-cost tier)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Filter out low-value errors
    beforeSend(event, _hint) {
      // Ignore errors from browser extensions
      if (
        event.exception?.values?.[0]?.stacktrace?.frames?.some(
          (frame) =>
            frame.filename?.includes("chrome-extension://") ||
            frame.filename?.includes("moz-extension://")
        )
      ) {
        return null;
      }

      // Ignore network errors (handled by React Query)
      if (event.exception?.values?.[0]?.type === "NetworkError") {
        return null;
      }

      return event;
    },

    // Filter breadcrumbs to reduce noise
    beforeBreadcrumb(breadcrumb, _hint) {
      // Ignore console breadcrumbs in development
      if (
        breadcrumb.category === "console" &&
        process.env.NODE_ENV === "development"
      ) {
        return null;
      }

      // Ignore frequent fetch calls
      if (
        breadcrumb.category === "fetch" &&
        breadcrumb.data?.url?.includes("/api/health")
      ) {
        return null;
      }

      return breadcrumb;
    },

    // Integration configuration
    integrations: [
      Sentry.browserTracingIntegration({
        // Trace specific navigation
        tracePropagationTargets: [
          "localhost",
          /^https:\/\/[^/]*\.vercel\.app/,
          /^\/api\//,
        ],
      }),
    ],
  });

  initialized = true;
}

/**
 * Capture an exception with additional context
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error("[Sentry]", error, context);
    return;
  }

  Sentry.captureException(error, {
    contexts: {
      custom: context || {},
    },
  });
}

/**
 * Capture a message with additional context
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, unknown>
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.log(`[Sentry:${level}]`, message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    contexts: {
      custom: context || {},
    },
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(
  user: { id: string; email?: string; username?: string } | null
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: "info",
  });
}

/**
 * Start a performance span
 */
export function startSpan<T>(
  name: string,
  op: string,
  callback: () => T | Promise<T>
): T | Promise<T> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return callback();
  }

  return Sentry.startSpan({ name, op }, callback);
}

/**
 * Flush events to Sentry (useful before page unload)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return true;
  }

  return Sentry.flush(timeout);
}

// Auto-initialize on import
if (typeof window !== "undefined") {
  initSentry();
}
