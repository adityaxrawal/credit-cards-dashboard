import { z } from "zod";

export const GoogleOAuthRequestSchema = z.object({
  code: z.string().min(10),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(20).optional(), // Optional because it comes from httpOnly cookie
});

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(20).optional(),
});

export type GoogleOAuthRequest = z.infer<typeof GoogleOAuthRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;
