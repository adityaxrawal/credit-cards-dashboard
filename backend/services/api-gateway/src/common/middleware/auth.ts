import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";
import {
  validateToken,
  validateSession,
  extractToken,
  TokenError,
  TokenErrorCode,
} from "shared/lib/auth/tokenHandler";
import { logger } from "shared/monitoring/logger";

/**
 * Extended Express Request with authentication context
 * Explicitly extends Request to ensure all Express properties are available
 */
export interface AuthRequest extends Request {
  userId?: string;
  email?: string;
  userRole?: string; // simple role flag for admin-only endpoints
}

/**
 * Middleware to verify JWT token and attach user info to request
 * Checks for token in cookies first, then Authorization header
 * Uses centralized token handler for consistent validation
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from cookies or headers
    const token = extractToken(req.headers, req.cookies);

    // Validate token
    const decoded = await validateToken(token, "access");

    // Validate session exists in Redis
    await validateSession(decoded.userId);

    // Attach user info to request
    req.userId = decoded.userId;
    req.email = decoded.email;
    req.userRole = decoded.role || "user";

    logger.debug("User authenticated", { userId: decoded.userId, email: decoded.email });

    next();
  } catch (error) {
    if (error instanceof TokenError) {
      // Map token errors to appropriate HTTP responses with error codes
      const errorResponse = {
        success: false,
        error: error.code,
        message: error.message,
      };

      // For expired tokens, include a hint that refresh should be attempted
      if (error.code === TokenErrorCode.TOKEN_EXPIRED) {
        logger.warn("Token expired for request", {
          path: req.path,
          method: req.method,
        });
        res.status(401).json({
          ...errorResponse,
          hint: "TOKEN_REFRESH_REQUIRED",
        });
        return;
      }

      logger.warn("Authentication failed", {
        errorCode: error.code,
        path: req.path,
        method: req.method,
      });

      res.status(error.statusCode).json(errorResponse);
      return;
    }

    // Unknown error
    logger.error("Authentication middleware error", error);
    next(new AppError("Authentication failed", 401));
  }
};
