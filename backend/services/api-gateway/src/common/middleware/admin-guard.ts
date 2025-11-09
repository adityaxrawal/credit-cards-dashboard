/**
 * Admin Guard Middleware
 * Ensures only admin users can access certain routes
 */

import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import { HTTP_STATUS } from "../../constants";
import { logger } from "shared/monitoring/logger";
import { supabase } from "shared/database/supabase";

/**
 * Check if user has admin role
 * For now, we check if the user email matches admin email(s) from env
 */
export async function isAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    // Get user from database
    const { data: user, error } = await supabase
      .from("users")
      .select("email, role")
      .eq("id", userId)
      .single();

    if (error || !user) {
      logger.error("Failed to fetch user for admin check:", error);
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    // Check if user is admin (either by role or email)
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    const isAdminUser = user.role === "admin" || adminEmails.includes(user.email);

    if (!isAdminUser) {
      logger.warn(`Non-admin user attempted to access admin endpoint: ${user.email}`);
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: "Admin access required",
      });
      return;
    }

    // User is admin, proceed
    next();
  } catch (error) {
    logger.error("Admin guard error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
    });
  }
}
