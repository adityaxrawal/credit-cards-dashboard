/**
 * Rate Limiting Middleware
 * Per spec Section 8: 100 requests per 15 minutes
 */

import rateLimit from 'express-rate-limit';

/**
 * Global API rate limiter
 * 100 requests per 15-minute window per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
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
    max: 20, // 20 requests per window
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
});

/**
 * Rate limiter for Gmail sync endpoints
 * 10 requests per 15-minute window (expensive operation)
 */
export const gmailSyncLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many sync requests, please try again later.',
            retryAfter: '15 minutes',
        },
    },
});
