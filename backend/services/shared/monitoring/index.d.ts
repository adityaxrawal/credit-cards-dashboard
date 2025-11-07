/**
 * Monitoring Module - Centralized Exports
 * Phase 6: Post-Launch & Optimization
 *
 * Now supports GlitchTip (self-hosted, Sentry SDK compatible)
 */
export * from "./sentry-config";
export * from "./metrics-collector";
export * from "./logger";
export { healthCheck } from "./health-check";
export { initializeErrorTracking, errorTrackingConfig, captureError, captureMessage, } from "./sentry-config";
