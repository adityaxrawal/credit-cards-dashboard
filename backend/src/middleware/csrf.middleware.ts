import csurf from 'csurf';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * CSRF Protection Middleware
 * Uses cookie-based token storage
 */
export const csrfProtection = csurf({
    cookie: {
        key: '_csrf',
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        httpOnly: true
    }
});

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
