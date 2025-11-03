/**
 * Sentry Configuration for Error Tracking and Performance Monitoring
 * Phase 6: Post-Launch & Optimization
 */

import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

export const sentryConfig: SentryConfig = {
  dsn: process.env.SENTRY_DSN || "",
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled: process.env.SENTRY_ENABLED === "true",
};

export function initializeSentry(serviceName: string): void {
  if (!sentryConfig.enabled || !sentryConfig.dsn) {
    console.log("Sentry is disabled or DSN not configured");
    return;
  }

  Sentry.init({
    dsn: sentryConfig.dsn,
    environment: sentryConfig.environment,
    serverName: serviceName,

    // Performance Monitoring
    tracesSampleRate: sentryConfig.tracesSampleRate,
    profilesSampleRate: sentryConfig.profilesSampleRate,

    integrations: [
      new ProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: undefined as any }),
    ],

    // Error filtering
    beforeSend(event, hint) {
      // Filter out specific errors
      const error = hint.originalException;

      if (error instanceof Error) {
        // Don't send validation errors
        if (error.message.includes("Validation Error")) {
          return null;
        }

        // Don't send 404 errors
        if (error.message.includes("Not Found")) {
          return null;
        }
      }

      return event;
    },

    // Additional context
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "log") {
        return null;
      }
      return breadcrumb;
    },
  });

  console.log(
    `✅ Sentry initialized for ${serviceName} in ${sentryConfig.environment} mode`
  );
}

export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  if (!sentryConfig.enabled) {
    console.error("Error:", error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, any>
): void {
  if (!sentryConfig.enabled) {
    console.log(message, context);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
}

export { Sentry };
