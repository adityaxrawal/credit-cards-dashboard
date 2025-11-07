import { apiGet, apiPost } from "./client";
import type { AuthResponse } from "@/types";

export const authApi = {
  /**
   * Exchange Google OAuth code for access token
   */
  async googleLogin(code: string): Promise<AuthResponse> {
    return apiPost<AuthResponse>("/auth/google", {
      code,
    });
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return apiPost<AuthResponse>("/auth/refresh", {
      refreshToken,
    });
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiPost<void>("/auth/logout");
  },

  /**
   * Get current user info
   */
  async getCurrentUser() {
    return apiGet("/auth/me");
  },
};
