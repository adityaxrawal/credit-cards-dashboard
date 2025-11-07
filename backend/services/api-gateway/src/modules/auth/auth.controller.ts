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

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Google OAuth failed", error as Error);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
        message: error instanceof Error ? error.message : "Authentication failed",
      });
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  static async refreshToken(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD,
          message: "Refresh token is required",
        });
        return;
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.status(HTTP_STATUS.OK).json(result);
    } catch (error) {
      logger.error("Token refresh failed", error as Error);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.TOKEN_EXPIRED,
        message: error instanceof Error ? error.message : "Token refresh failed",
      });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  static async logout(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      await authService.logout(userId);

      res.status(HTTP_STATUS.OK).json({
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }

  /**
   * Get user profile
   * GET /api/auth/profile
   */
  static async getProfile(req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    try {
      const userId = req.userId!;

      const user = await authService.getUserInfo(userId);

      res.status(HTTP_STATUS.OK).json(user);
    } catch (error) {
      logger.error("Get profile failed", error as Error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }
}
