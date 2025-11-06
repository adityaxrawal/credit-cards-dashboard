import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants";
import { logger } from "../../utils/logger";

/**
 * Auth Controller
 * Handles HTTP requests for authentication
 */
export class AuthController {
  /**
   * Handle Google OAuth callback
   * POST /api/auth/google
   */
  static async googleOAuth(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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
    } catch (error: any) {
      logger.error("Google OAuth failed", {  error  });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
        message: error.message,
      });
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  static async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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
    } catch (error: any) {
      logger.error("Token refresh failed", {  error  });
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.AUTH.TOKEN_EXPIRED,
        message: error.message,
      });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
        });
        return;
      }

      await authService.logout(userId);

      res.status(HTTP_STATUS.OK).json({
        message: "Logged out successfully",
      });
    } catch (error: any) {
      logger.error("Logout failed", {  error  });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }

  /**
   * Get user profile
   * GET /api/auth/profile
   */
  static async getProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          error: ERROR_MESSAGES.AUTH.UNAUTHORIZED,
        });
        return;
      }

      const user = await authService.getUserInfo(userId);

      res.status(HTTP_STATUS.OK).json(user);
    } catch (error: any) {
      logger.error("Get profile failed", {  error  });
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      });
    }
  }
}
