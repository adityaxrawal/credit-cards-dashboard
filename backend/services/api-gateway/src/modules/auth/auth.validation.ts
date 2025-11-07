import { z } from "zod";

/**
 * Auth Validation Schemas
 */

export const googleOAuthSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  monthly_budget: z.number().positive().optional(),
  timezone: z.string().optional(),
});
