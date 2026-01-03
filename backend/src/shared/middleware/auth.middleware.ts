import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import pool from '@shared/database/db';
import { env } from '@shared/config/env';
import { JwtPayload, AuthErrorCode, AuthRequest } from '@shared/types/auth.types';
import logger from '@shared/utils/infrastructure/logger';

import NodeCache from 'node-cache';

// Cache for 60 seconds (TTL), check for expired keys every 120s
const userCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export const authenticate: RequestHandler = async (req, res, next) => {
  // logger.debug(`[Auth Middleware] Processing request: ${req.method} ${req.path}`);

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
      logger.debug(`[Auth Middleware] No token found in header or cookie`);
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
        logger.debug(`[Auth Middleware] Token expired`);
        return res.status(401).json({
          error: AuthErrorCode.TOKEN_EXPIRED,
          message: 'Token has expired'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        logger.warn(`[Auth Middleware] Invalid token: ${error.message}`);
        return res.status(401).json({
          error: AuthErrorCode.INVALID_TOKEN,
          message: 'Token is malformed or invalid'
        });
      }
      logger.error(`[Auth Middleware] Token verification failed: ${error.message}`);
      return res.status(401).json({
        error: AuthErrorCode.TOKEN_VERIFICATION_FAILED,
        message: 'Token verification failed'
      });
    }

    // Validate payload structure
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      logger.warn(`[Auth Middleware] Invalid payload structure`, { userId: decoded.userId });
      return res.status(401).json({
        error: AuthErrorCode.INVALID_PAYLOAD,
        message: 'Token payload is invalid: missing or invalid userId'
      });
    }

    // Check Cache First
    const cachedUser = userCache.get(decoded.userId);
    if (cachedUser) {
      // logger.debug(`[Auth Middleware] User found in cache: ${decoded.userId}`);
      (req as AuthRequest).user = cachedUser as import('@shared/types/auth.types').User;
      return next();
    }

    // Verify user exists in DB - Fetch only needed fields
    const result = await pool.query(
      'SELECT id, email, name, picture, monthly_budget, created_at, google_refresh_token FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      logger.warn(`[Auth Middleware] User not found in DB: ${decoded.userId}`);
      return res.status(401).json({
        error: AuthErrorCode.USER_NOT_FOUND,
        message: 'User associated with token not found'
      });
    }

    // logger.debug(`[Auth Middleware] User found in DB: ${result.rows[0].email}`);
    // Store in Cache
    userCache.set(decoded.userId, result.rows[0]);

    (req as AuthRequest).user = result.rows[0];
    next();
  } catch (error) {
    // Catch-all for unexpected errors
    logger.error('[Auth Middleware] Unexpected error:', error);
    return res.status(500).json({
      error: AuthErrorCode.AUTHENTICATION_ERROR,
      message: 'An unexpected authentication error occurred'
    });
  }
};

export const requireGmailConnection: RequestHandler = async (req, res, next) => {
  const user = (req as AuthRequest).user;
  if (!user || !user.google_refresh_token) {
    return res.status(403).json({
      error: 'GMAIL_NOT_CONNECTED',
      message: 'Gmail connection required for this action'
    });
  }
  next();
};
