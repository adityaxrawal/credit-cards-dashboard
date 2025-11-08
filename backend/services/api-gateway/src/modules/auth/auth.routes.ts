import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../common/middleware/auth";
import { validateBody } from "../../common/middleware/validation";
import {
  GoogleOAuthRequestSchema,
  RefreshTokenRequestSchema,
  LogoutRequestSchema,
} from "./dto/auth.dto";

const router = Router();

/**
 * @route   POST /api/auth/google
 * @desc    Authenticate with Google OAuth
 * @access  Public
 */
router.post("/google", validateBody(GoogleOAuthRequestSchema), AuthController.googleOAuth);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post("/refresh", validateBody(RefreshTokenRequestSchema), AuthController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Protected
 */
router.post("/logout", authenticate, validateBody(LogoutRequestSchema), AuthController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user (alias for profile)
 * @access  Protected
 */
router.get("/me", authenticate, AuthController.getProfile);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Protected
 */
router.get("/profile", authenticate, AuthController.getProfile);

/**
 * @route   GET /api/auth/debug-config
 * @desc    Debug endpoint to verify OAuth configuration
 * @access  Public (development only)
 */
router.get("/debug-config", AuthController.debugConfig);

export default router;
