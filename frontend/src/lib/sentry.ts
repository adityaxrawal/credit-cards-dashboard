/**
 * Sentry Client Configuration for Next.js Frontend - STUB
 *
 * This is a stub implementation. To enable error tracking:
 * 1. Install: npm install @sentry/nextjs
 * 2. Replace this file with proper Sentry implementation
 */

/**
 * Initialize Sentry for client-side error tracking
 * Stub - no-op
 */
export function initSentry(): void {
  // No-op stub
}

/**
 * Capture an exception with additional context
 * Stub - logs to console
 */
export function captureException(
  error: Error,
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "development") {
    console.error("[Sentry Stub]", error, context);
  }
}

/**
 * Capture a message with additional context
 * Stub - logs to console
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Sentry Stub:${level}]`, message, context);
  }
}

/**
 * Set user context for error tracking
 * Stub - no-op
 */
export function setUser(
  _user: { id: string; email?: string; username?: string } | null
): void {
  // No-op stub
}

/**
 * Add breadcrumb for debugging
 * Stub - no-op
 */
export function addBreadcrumb(
  _message: string,
  _category: string,
  _data?: Record<string, unknown>
): void {
  // No-op stub
}

/**
 * Start a performance span
 * Stub - just executes callback
 */
export function startSpan<T>(
  _name: string,
  _op: string,
  callback: () => T | Promise<T>
): T | Promise<T> {
  return callback();
}

/**
 * Flush events to Sentry
 * Stub - always returns true
 */
export async function flush(_timeout = 2000): Promise<boolean> {
  return true;
}

// Auto-initialize on import (no-op for stub)
if (typeof window !== "undefined") {
  initSentry();
}
