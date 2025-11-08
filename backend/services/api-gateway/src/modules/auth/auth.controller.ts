import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../common/middleware/auth";
import { authService } from "./auth.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "shared/monitoring/logger";

/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */
export class AuthController {
  /**
   * Handle Google OAuth callback
   * POST /api/auth/google
   */
  static async googleOAuth(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { code } = req.body;

      if (!code) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD,
          message: "Authorization code is required",
        });
        return;
      }

      const result = await authService.googleOAuth(code);

      // Set httpOnly cookies for secure token storage
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // HTTPS only in production
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      };

      // Set access token (shorter expiry)
      res.cookie("accessToken", result.accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      // Set refresh token (longer expiry)
      res.cookie("refreshToken", result.refreshToken, cookieOptions);

      // Also store user ID for quick reference
      res.cookie("userId", result.user.id, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax" as const,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          user: result.user, // Send user data in response
          // Don't send tokens in response body - they're in cookies
        },
      });
    } catch (error) {
      logger.error("Google OAuth failed", error as Error);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
        message: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  }

  /**
   * Refresh access token using httpOnly cookie
   * POST /api/auth/refresh
   */
  static async refreshToken(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      // Get refresh token from httpOnly cookie
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: ERROR_MESSAGES.AUTH.TOKEN_EXPIRED,
          message: "No refresh token found. Please login again.",
        });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      // Set new access token as httpOnly cookie
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax" as const,
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: "/",
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      logger.error("Token refresh failed", error as Error);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: ERROR_MESSAGES.AUTH.TOKEN_EXPIRED,
        message: error instanceof Error ? error.message : "Token refresh failed",
      });
    }
  }

  /**
   * Logout user and clear cookies
   * POST /api/auth/logout
   */
  static async logout(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      // Get userId from cookie if not in request (from middleware)
      const userId = req.userId || req.cookies?.userId;

      if (userId) {
        await authService.logout(userId);
      }

      // Clear all auth cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };

      res.clearCookie("accessToken", cookieOptions);
      res.clearCookie("refreshToken", cookieOptions);
      res.clearCookie("userId", cookieOptions);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Logout failed",
      });
    }
  }

  /**
   * Get user profile
   * GET /api/auth/me (aliased as /api/auth/profile)
   */
  static async getProfile(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      const user = await authService.getUserInfo(userId);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      logger.error("Get profile failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : "Failed to get profile",
      });
    }
  }

  /**
   * Debug OAuth configuration
   * GET /api/auth/debug-config
   * Development only - shows OAuth configuration for troubleshooting
   */
  static async debugConfig(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      // Only allow in development
      if (process.env.NODE_ENV === "production") {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: "Debug endpoint not available in production",
        });
        return;
      }

      const config = {
        environment: process.env.NODE_ENV,
        googleClientId: process.env.GOOGLE_CLIENT_ID?.slice(0, 20) + "...",
        googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
        frontendUrl: process.env.FRONTEND_URL,
        backendPort: process.env.PORT,
        expectedFlow: {
          step1: "User clicks 'Continue with Google' on frontend",
          step2: `Frontend redirects to Google with redirect_uri: ${process.env.GOOGLE_REDIRECT_URI}`,
          step3: "User grants permissions on Google",
          step4: `Google redirects back to: ${process.env.GOOGLE_REDIRECT_URI}?code=...`,
          step5: "Frontend sends code to backend /api/auth/google",
          step6: `Backend exchanges code with Google using redirect_uri: ${process.env.GOOGLE_REDIRECT_URI}`,
          step7: "Backend returns tokens to frontend",
        },
        googleConsoleSetup: {
          instruction: "In Google Cloud Console, add this EXACT redirect URI:",
          redirectUri: process.env.GOOGLE_REDIRECT_URI,
          notes: [
            "Must include http:// or https://",
            "Must include the port for localhost (:3000)",
            "Must include the path (/login)",
            "No trailing slash",
            "Must match exactly what frontend sends",
          ],
        },
        troubleshooting: {
          redirect_uri_mismatch:
            "The redirect URI in Google Console doesn't match what's being sent",
          access_denied: "User cancelled or app not verified/test user not added",
        },
      };

      res.status(HTTP_STATUS.OK).json({
        success: true,
        config,
      });
    } catch (error) {
      logger.error("Debug config failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to get debug config",
      });
    }
  }
}
