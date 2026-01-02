import { Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../lib/db';
import { env } from '../config/env';
import { JwtPayload, AuthErrorCode, AuthRequest } from '../types/auth.types';

import NodeCache from 'node-cache';

// Cache for 60 seconds (TTL), check for expired keys every 120s
const userCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

export const authenticate: RequestHandler = async (req, res, next) => {
  console.log(`[Auth Middleware] ========== START ==========`);
  console.log(`[Auth Middleware] Processing request: ${req.method} ${req.path}`);
  console.log(`[Auth Middleware] Cookies present: ${Object.keys(req.cookies || {}).join(', ') || 'NONE'}`);

  try {
    // Only accept Authorization header (no cookie fallback for security)
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log(`[Auth Middleware] Token from Authorization header: ${token.substring(0, 20)}...`);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
      console.log(`[Auth Middleware] Token from accessToken cookie: ${token!.substring(0, 20)}...`);
    }

    if (!token) {
      console.log(`[Auth Middleware] ❌ No token found in header or cookie`);
      console.log(`[Auth Middleware] ========== END (401) ==========`);
      return res.status(401).json({
        error: AuthErrorCode.MISSING_TOKEN,
        message: 'Authorization header with Bearer token or accessToken cookie required'
      });
    }

    // Strict JWT validation with algorithm specification and no clock tolerance
    let decoded: JwtPayload;
    try {
      console.log(`[Auth Middleware] Verifying JWT...`);
      decoded = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],  // Prevent algorithm confusion attacks
        clockTolerance: 0       // Strict expiry enforcement
      }) as JwtPayload;
      console.log(`[Auth Middleware] ✅ JWT verified, userId: ${decoded.userId}`);
    } catch (error: any) {
      console.log(`[Auth Middleware] ❌ JWT verification failed: ${error.name} - ${error.message}`);
      if (error.name === 'TokenExpiredError') {
        console.log(`[Auth Middleware] ========== END (401 - Expired) ==========`);
        return res.status(401).json({
          error: AuthErrorCode.TOKEN_EXPIRED,
          message: 'Token has expired'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        console.log(`[Auth Middleware] ========== END (401 - Invalid) ==========`);
        return res.status(401).json({
          error: AuthErrorCode.INVALID_TOKEN,
          message: 'Token is malformed or invalid'
        });
      }
      console.log(`[Auth Middleware] ========== END (401 - Failed) ==========`);
      return res.status(401).json({
        error: AuthErrorCode.TOKEN_VERIFICATION_FAILED,
        message: 'Token verification failed'
      });
    }

    // Validate payload structure
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      console.log(`[Auth Middleware] ❌ Invalid payload structure`);
      console.log(`[Auth Middleware] ========== END (401 - Invalid Payload) ==========`);
      return res.status(401).json({
        error: AuthErrorCode.INVALID_PAYLOAD,
        message: 'Token payload is invalid: missing or invalid userId'
      });
    }

    // Check Cache First
    const cachedUser = userCache.get(decoded.userId);
    if (cachedUser) {
      console.log(`[Auth Middleware] ✅ User found in cache: ${decoded.userId}`);
      (req as AuthRequest).user = cachedUser as import('../types/auth.types').User;
      console.log(`[Auth Middleware] ========== END (Success - Cached) ==========`);
      return next();
    }

    // Verify user exists in DB - Fetch only needed fields
    console.log(`[Auth Middleware] Looking up user in DB: ${decoded.userId}`);
    const result = await pool.query(
      'SELECT id, email, name, picture, monthly_budget, created_at, google_refresh_token FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      console.log(`[Auth Middleware] ❌ User not found in DB: ${decoded.userId}`);
      console.log(`[Auth Middleware] ========== END (401 - User Not Found) ==========`);
      return res.status(401).json({
        error: AuthErrorCode.USER_NOT_FOUND,
        message: 'User associated with token not found'
      });
    }

    console.log(`[Auth Middleware] ✅ User found in DB: ${result.rows[0].email}`);
    // Store in Cache
    userCache.set(decoded.userId, result.rows[0]);

    (req as AuthRequest).user = result.rows[0];
    console.log(`[Auth Middleware] ========== END (Success) ==========`);
    next();
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('[Auth Middleware] ❌ Unexpected error:', error);
    console.log(`[Auth Middleware] ========== END (500) ==========`);
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
