import apiClient from "./client";
import type { AuthResponse } from "@/types";

export const authApi = {
  /**
   * Exchange Google OAuth code for access token
   */
  async googleLogin(code: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/google", {
      code,
    });
    return response.data;
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/auth/refresh", {
      refreshToken,
    });
    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiClient.post("/auth/logout");
  },

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
};
