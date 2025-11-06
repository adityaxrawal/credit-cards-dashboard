"use strict";
/**
 * Error Tracking Configuration - GlitchTip (Sentry SDK Compatible)
 * Phase 6: Post-Launch & Optimization
 *
 * Note: GlitchTip is 100% compatible with Sentry SDK
 * Simply use GlitchTip DSN instead of Sentry.io DSN
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sentry = exports.initializeSentry = exports.errorTrackingConfig = void 0;
exports.initializeErrorTracking = initializeErrorTracking;
exports.captureError = captureError;
exports.captureMessage = captureMessage;
const Sentry = __importStar(require("@sentry/node"));
exports.Sentry = Sentry;
const profiling_node_1 = require("@sentry/profiling-node");
// Support both GLITCHTIP_DSN (new) and SENTRY_DSN (legacy fallback)
exports.errorTrackingConfig = {
    dsn: process.env.GLITCHTIP_DSN || process.env.SENTRY_DSN || "",
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    enabled: process.env.GLITCHTIP_ENABLED === "true" ||
        process.env.SENTRY_ENABLED === "true",
};
function initializeErrorTracking(serviceName) {
    if (!exports.errorTrackingConfig.enabled || !exports.errorTrackingConfig.dsn) {
        console.log("Error tracking is disabled or DSN not configured");
        return;
    }
    const provider = exports.errorTrackingConfig.dsn.includes("glitchtip")
        ? "GlitchTip"
        : "Sentry";
    console.log(`Initializing ${provider} error tracking for ${serviceName}...`);
    Sentry.init({
        dsn: exports.errorTrackingConfig.dsn,
        environment: exports.errorTrackingConfig.environment,
        serverName: serviceName,
        // Performance Monitoring
        tracesSampleRate: exports.errorTrackingConfig.tracesSampleRate,
        profilesSampleRate: exports.errorTrackingConfig.profilesSampleRate,
        integrations: [
            (0, profiling_node_1.nodeProfilingIntegration)(),
            Sentry.httpIntegration(),
            Sentry.expressIntegration(),
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
    console.log(`${provider} initialized for ${serviceName} in ${exports.errorTrackingConfig.environment} environment`);
}
// Legacy function name for backwards compatibility
exports.initializeSentry = initializeErrorTracking;
function captureError(error, context) {
    if (!exports.errorTrackingConfig.enabled) {
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
function captureMessage(message, level = "info", context) {
    if (!exports.errorTrackingConfig.enabled) {
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
//# sourceMappingURL=sentry-config.js.map