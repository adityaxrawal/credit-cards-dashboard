import { apiClient } from "@/lib/api-client";

/**
 * Token Refresh Utility
 * Automatically refreshes access token before it expires
 */

let refreshTimer: NodeJS.Timeout | null = null;

/**
 * Start automatic token refresh
 * Access token expires in 15 minutes, refresh at 14 minutes
 */
export function startTokenRefresh(
  onRefreshSuccess?: () => void,
  onRefreshError?: (error: Error) => void
) {
  console.log("[TokenRefresh] Starting auto-refresh timer");
  // Clear any existing timer
  stopTokenRefresh();

  // Refresh every 55 minutes (access token expires in 60 minutes) - preventing premature refreshes
  const refreshInterval = 55 * 60 * 1000;

  refreshTimer = setInterval(async () => {
    try {
      // apiClient handles CSRF token automatically
      const response = await apiClient.post<{ success: boolean; data: unknown }>(
        "/api/auth/refresh"
      );

      if (response.success && onRefreshSuccess) {
        onRefreshSuccess();
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      stopTokenRefresh();
      if (onRefreshError) {
        onRefreshError(error as Error);
      }
    }
  }, refreshInterval);

  // Initial check removed - AuthContext handles the first check via /api/auth/me
}

/**
 * Stop automatic token refresh
 */
export function stopTokenRefresh() {
  console.log("[TokenRefresh] Stopping auto-refresh timer");
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Manually trigger token refresh
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    console.log("[TokenRefresh] Manual refresh triggered");
    await apiClient.post("/api/auth/refresh");
    return true;
  } catch (error) {
    console.error("Manual token refresh failed:", error);
    return false;
  }
}
