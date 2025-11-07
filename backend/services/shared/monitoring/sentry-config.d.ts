/**
 * Error Tracking Configuration - GlitchTip (Sentry SDK Compatible)
 * Phase 6: Post-Launch & Optimization
 *
 * Note: GlitchTip is 100% compatible with Sentry SDK
 * Simply use GlitchTip DSN instead of Sentry.io DSN
 */
import * as Sentry from "@sentry/node";
export interface ErrorTrackingConfig {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
    enabled: boolean;
    serviceName?: string;
}
export declare const errorTrackingConfig: ErrorTrackingConfig;
export declare function initializeErrorTracking(serviceName: string): void;
export declare const initializeSentry: typeof initializeErrorTracking;
export declare function captureError(error: Error, context?: Record<string, any>): void;
export declare function captureMessage(message: string, level?: Sentry.SeverityLevel, context?: Record<string, any>): void;
export { Sentry };
