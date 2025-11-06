/**
 * Error Tracking Configuration - GlitchTip (Sentry SDK Compatible)
 * Phase 6: Post-Launch & Optimization
 *
 * Note: GlitchTip is 100% compatible with Sentry SDK
 * Simply use GlitchTip DSN instead of Sentry.io DSN
 */

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export interface ErrorTrackingConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
  serviceName?: string;
}

// Support both GLITCHTIP_DSN (new) and SENTRY_DSN (legacy fallback)
export const errorTrackingConfig: ErrorTrackingConfig = {
  dsn: process.env.GLITCHTIP_DSN || process.env.SENTRY_DSN || "",
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  enabled:
    process.env.GLITCHTIP_ENABLED === "true" ||
    process.env.SENTRY_ENABLED === "true",
};

export function initializeErrorTracking(serviceName: string): void {
  if (!errorTrackingConfig.enabled || !errorTrackingConfig.dsn) {
    console.log("Error tracking is disabled or DSN not configured");
    return;
  }

  const provider = errorTrackingConfig.dsn.includes("glitchtip")
    ? "GlitchTip"
    : "Sentry";
  console.log(`Initializing ${provider} error tracking for ${serviceName}...`);

  Sentry.init({
    dsn: errorTrackingConfig.dsn,
    environment: errorTrackingConfig.environment,
    serverName: serviceName,

    // Performance Monitoring
    tracesSampleRate: errorTrackingConfig.tracesSampleRate,
    profilesSampleRate: errorTrackingConfig.profilesSampleRate,

    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],

    // Error filtering
    beforeSend(
      event: Sentry.ErrorEvent,
      hint: Sentry.EventHint
    ): Sentry.ErrorEvent | null {
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
    beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === "console" && breadcrumb.level === "log") {
        return null;
      }
      return breadcrumb;
    },
  });

  console.log(
    `${provider} initialized for ${serviceName} in ${errorTrackingConfig.environment} environment`
  );
}

// Legacy function name for backwards compatibility
export const initializeSentry = initializeErrorTracking;

export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  if (!errorTrackingConfig.enabled) {
    console.error("Error:", error, context);
    return;
  }

  Sentry.withScope((scope: Sentry.Scope) => {
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
  if (!errorTrackingConfig.enabled) {
    console.log(message, context);
    return;
  }

  Sentry.withScope((scope: Sentry.Scope) => {
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
