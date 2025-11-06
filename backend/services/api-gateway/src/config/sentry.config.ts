/**
 * Sentry Configuration
 * Error tracking and monitoring
 */

export const sentryConfig = {
  dsn: process.env.SENTRY_DSN || "",
  environment: process.env.NODE_ENV || "development",

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable/disable based on environment
  enabled: !!process.env.SENTRY_DSN && process.env.NODE_ENV !== "test",

  // Release tracking
  release: process.env.SENTRY_RELEASE || "unknown",

  // Server name
  serverName: process.env.RENDER_SERVICE_NAME || "api-gateway",
} as const;

export type SentryConfig = typeof sentryConfig;
