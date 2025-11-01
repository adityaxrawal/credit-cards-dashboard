import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/google
 * Handle Google OAuth callback with authorization code
 */
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        error: "Authorization code is required",
      });
    }

    const result = await authService.googleOAuth(code);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Google OAuth error:", error);
    res.status(401).json({
      error: error.message || "Authentication failed",
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token is required",
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Token refresh error:", error);
    res.status(401).json({
      error: error.message || "Token refresh failed",
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post(
  "/logout",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: "User not authenticated",
        });
      }

      await authService.logout(req.userId);

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({
        error: error.message || "Logout failed",
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user information
 */
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }

    const user = await authService.getUserInfo(req.userId);

    res.json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch user information",
    });
  }
});

export default router;
