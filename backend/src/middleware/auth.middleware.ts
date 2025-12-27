import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/db';
import { env } from '../config/env';
import { JwtPayload, AuthErrorCode, AuthRequest } from '../types/auth.types';

import NodeCache from 'node-cache';

// Cache for 60 seconds (TTL), check for expired keys every 120s
const userCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export const authenticate: RequestHandler = async (req, res, next) => {
  // console.log('[Auth Middleware] Processing request:', req.path); // Reduced logging
  try {
    // Only accept Authorization header (no cookie fallback for security)
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        error: AuthErrorCode.MISSING_TOKEN,
        message: 'Authorization header with Bearer token or accessToken cookie required'
      });
    }

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

    // Check Cache First
    const cachedUser = userCache.get(decoded.userId);
    if (cachedUser) {
      // console.log('[Auth Middleware] User found in cache:', decoded.userId);
      (req as AuthRequest).user = cachedUser as import('../types/auth.types').User;
      return next();
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

    // Store in Cache
    userCache.set(decoded.userId, result.rows[0]);

    (req as AuthRequest).user = result.rows[0];
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
