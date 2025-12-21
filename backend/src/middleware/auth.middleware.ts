import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/db';
import { env } from '../config/env';
import { JwtPayload, AuthErrorCode } from '../types/auth.types';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only accept Authorization header (no cookie fallback for security)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: AuthErrorCode.MISSING_TOKEN,
        message: 'Authorization header with Bearer token required'
      });
    }

    const token = authHeader.split(' ')[1];

    // Strict JWT validation with algorithm specification and no clock tolerance
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],  // Prevent algorithm confusion attacks
        clockTolerance: 0       // Strict expiry enforcement
      }) as JwtPayload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: AuthErrorCode.TOKEN_EXPIRED,
          message: 'Token has expired'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: AuthErrorCode.INVALID_TOKEN,
          message: 'Token is malformed or invalid'
        });
      }
      return res.status(401).json({
        error: AuthErrorCode.TOKEN_VERIFICATION_FAILED,
        message: 'Token verification failed'
      });
    }

    // Validate payload structure
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      return res.status(401).json({
        error: AuthErrorCode.INVALID_PAYLOAD,
        message: 'Token payload is invalid: missing or invalid userId'
      });
    }

    // Verify user exists in DB - Fetch only needed fields
    const result = await pool.query(
      'SELECT id, email, created_at, google_refresh_token FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: AuthErrorCode.USER_NOT_FOUND,
        message: 'User associated with token not found'
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('[Auth Middleware] Unexpected error:', error);
    return res.status(500).json({
      error: AuthErrorCode.AUTHENTICATION_ERROR,
      message: 'An unexpected authentication error occurred'
    });
  }
};
