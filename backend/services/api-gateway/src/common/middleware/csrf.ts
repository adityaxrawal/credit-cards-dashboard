/**
 * CSRF Protection Middleware
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * This is a zero-cost solution that doesn't require external dependencies or storage.
 *
 * How it works:
 * 1. On successful authentication, server sets a CSRF token in a cookie
 * 2. Frontend must read this cookie and send it as X-CSRF-Token header
 * 3. Server validates that cookie and header values match
 *
 * Security properties:
 * - Prevents CSRF attacks without requiring server-side state
 * - Cookie is HttpOnly=false so JavaScript can read it (required for double-submit)
 * - Cookie uses SameSite=Strict for additional protection
 * - Only applied to state-changing operations (POST, PUT, DELETE, PATCH)
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "shared/monitoring/logger";

/**
 * CSRF token cookie name
 */
export const CSRF_COOKIE_NAME = "__Host-CSRF-TOKEN";

/**
 * CSRF token header name
 */
export const CSRF_HEADER_NAME = "X-CSRF-Token";

/**
 * Generate a new CSRF token
 * @returns Cryptographically secure random token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Set CSRF token cookie
 * Call this after successful authentication
 *
 * @param res - Express response object
 * @param token - CSRF token (will be generated if not provided)
 * @returns The token that was set
 */
export function setCsrfTokenCookie(res: Response, token?: string): string {
  const csrfToken = token || generateCsrfToken();

  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be false so JavaScript can read it
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "strict", // Strict same-site policy
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: "/",
  });

  return csrfToken;
}

/**
 * Clear CSRF token cookie
 * Call this on logout
 *
 * @param res - Express response object
 */
export function clearCsrfTokenCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, {
    path: "/",
  });
}

/**
 * CSRF Protection Middleware
 *
 * Validates CSRF tokens for state-changing HTTP methods.
 * Exempts safe methods (GET, HEAD, OPTIONS) from validation.
 *
 * @param options - Middleware options
 * @returns Express middleware function
 */
export function csrfProtection(
  options: {
    excludePaths?: string[]; // Paths to exclude from CSRF check (e.g., webhooks)
    excludeMethods?: string[]; // Additional methods to exclude (beyond GET/HEAD/OPTIONS)
  } = {}
) {
  const excludePaths = options.excludePaths || [];
  const safeMethods = ["GET", "HEAD", "OPTIONS", ...(options.excludeMethods || [])];

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF check for safe methods
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Skip CSRF check for excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      logger.debug(`CSRF check skipped for excluded path: ${req.path}`);
      return next();
    }

    // Get CSRF token from cookie
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    // Get CSRF token from header
    const headerToken = req.header(CSRF_HEADER_NAME);

    // Validate tokens exist
    if (!cookieToken) {
      logger.warn("CSRF validation failed: No CSRF cookie found", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        error: "CSRF token missing",
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF protection requires a valid token cookie",
      });
      return;
    }

    if (!headerToken) {
      logger.warn("CSRF validation failed: No CSRF header found", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        error: "CSRF token missing",
        code: "CSRF_TOKEN_MISSING",
        message: "CSRF protection requires X-CSRF-Token header",
      });
      return;
    }

    // Validate tokens match (constant-time comparison)
    if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
      logger.warn("CSRF validation failed: Token mismatch", {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(403).json({
        success: false,
        error: "Invalid CSRF token",
        code: "CSRF_TOKEN_INVALID",
        message: "CSRF token validation failed",
      });
      return;
    }

    // CSRF validation successful
    logger.debug(`CSRF validation successful for ${req.method} ${req.path}`);
    next();
  };
}

/**
 * Middleware to refresh CSRF token
 * Can be applied to authenticated routes to ensure fresh tokens
 */
export function refreshCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const existingToken = req.cookies?.[CSRF_COOKIE_NAME];

  if (!existingToken) {
    // Generate new token if none exists
    const newToken = setCsrfTokenCookie(res);
    logger.debug("New CSRF token generated", { token: newToken.substring(0, 8) + "..." });
  }

  next();
}

/**
 * Helper to get current CSRF token from request
 * Useful for passing token to response headers for SPA initialization
 */
export function getCsrfToken(req: Request): string | undefined {
  return req.cookies?.[CSRF_COOKIE_NAME];
}
