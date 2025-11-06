"use strict";
/**
 * Monitoring Module - Centralized Exports
 * Phase 6: Post-Launch & Optimization
 *
 * Now supports GlitchTip (self-hosted, Sentry SDK compatible)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureMessage = exports.captureError = exports.errorTrackingConfig = exports.initializeErrorTracking = exports.healthCheck = void 0;
__exportStar(require("./sentry-config"), exports);
__exportStar(require("./metrics-collector"), exports);
__exportStar(require("./logger"), exports);
var health_check_1 = require("./health-check");
Object.defineProperty(exports, "healthCheck", { enumerable: true, get: function () { return health_check_1.healthCheck; } });
// Re-export with new names for clarity
var sentry_config_1 = require("./sentry-config");
Object.defineProperty(exports, "initializeErrorTracking", { enumerable: true, get: function () { return sentry_config_1.initializeErrorTracking; } });
Object.defineProperty(exports, "errorTrackingConfig", { enumerable: true, get: function () { return sentry_config_1.errorTrackingConfig; } });
Object.defineProperty(exports, "captureError", { enumerable: true, get: function () { return sentry_config_1.captureError; } });
Object.defineProperty(exports, "captureMessage", { enumerable: true, get: function () { return sentry_config_1.captureMessage; } });
//# sourceMappingURL=index.js.map