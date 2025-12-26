/**
 * Rate Limiting Middleware
 * Per spec Section 8: 100 requests per 15 minutes
 */

import rateLimit from 'express-rate-limit';

import { env } from '../config/env';

/**
 * Global API rate limiter
 * 100 requests per 15-minute window per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.NODE_ENV === 'development' ? 5000 : 100, // Relaxed for dev
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later.',
            retryAfter: '15 minutes',
        },
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health';
    },
});

/**
 * Stricter rate limiter for auth endpoints
 * 20 requests per 15-minute window
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.NODE_ENV === 'development' ? 1000 : 20, // Relaxed for dev
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many authentication attempts, please try again later.',
            retryAfter: '15 minutes',
        },
    },
    // Auth endpoints might not have user ID yet, so we stick to IP.
    // But specific endpoints like refresh-token might have user context if we extract it.
    // For login/signup, IP is the only way.
});

/**
 * Rate limiter for expensive operations (Gmail sync, CSV upload)
 * 10 requests per 15-minute window
 * Uses per-user limiting logic.
 */
export const expensiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: env.NODE_ENV === 'development' ? 500 : 10, // Relaxed for dev
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fall back to IP
        return (req as any).user?.id || req.ip;
    },
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests for this operation, please try again later.',
            retryAfter: '15 minutes',
        },
    },
});
