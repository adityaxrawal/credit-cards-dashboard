import csurf from 'csurf';
import { Request, Response, NextFunction } from 'express';
import { env } from '@shared/config/env';

/**
 * CSRF Protection Middleware
 * Uses cookie-based token storage
 */
const csrfMiddleware = csurf({
    cookie: {
        key: '_csrf',
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true
    }
});

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/auth/google' || req.path === '/api/auth/google' || req.path === '/api/gmail/scan-historical' || req.path === '/api/auth/refresh') {
        return next();
    }
    return csrfMiddleware(req, res, next);
};

/**
 * Handle CSRF errors specifically
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);

    // Handle CSRF token errors here
    res.status(403);
    res.json({
        error: {
            code: 'CSRF_ERROR',
            message: 'Invalid or missing CSRF token'
        }
    });
};
