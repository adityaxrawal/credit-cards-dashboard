import { apiClient } from "@/lib/api-client";

/**
 * Token Refresh Utility
 * Automatically refreshes access token before it expires
 */

let refreshTimer: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;
const MAX_RETRY_FAILURES = 3;

/**
 * Start automatic token refresh
 * Access token expires in 15 minutes, refresh at 14 minutes
 */
export function startTokenRefresh(
  onRefreshSuccess?: () => void,
  onRefreshError?: (error: Error) => void
) {
  console.log("[TokenRefresh] Starting auto-refresh timer");
  // Clear any existing timer and reset failure count
  stopTokenRefresh();
  consecutiveFailures = 0;

  // Refresh every 55 minutes (access token expires in 60 minutes) - preventing premature refreshes
  const refreshInterval = 55 * 60 * 1000;

  refreshTimer = setInterval(async () => {
    // Stop trying after max failures
    if (consecutiveFailures >= MAX_RETRY_FAILURES) {
      console.log("[TokenRefresh] Max failures reached, stopping");
      stopTokenRefresh();
      if (onRefreshError) {
        onRefreshError(new Error("Max refresh attempts exceeded"));
      }
      return;
    }

    try {
      // apiClient handles CSRF token automatically
      const response = await apiClient.post<{ success: boolean; data: unknown }>(
        "/api/auth/refresh"
      );

      if (response.success) {
        consecutiveFailures = 0; // Reset on success
        if (onRefreshSuccess) onRefreshSuccess();
      }
    } catch (error) {
      consecutiveFailures++;
      console.error(`Token refresh failed (attempt ${consecutiveFailures}/${MAX_RETRY_FAILURES}):`, error);

      // Check if this is a terminal error (user not found, invalid token)
      const axiosError = error as { response?: { data?: { clearSession?: boolean } } };
      if (axiosError?.response?.data?.clearSession) {
        console.log("[TokenRefresh] Session cleared by server, stopping refreshes");
        stopTokenRefresh();
        if (onRefreshError) {
          onRefreshError(error as Error);
        }
      }
      // For non-terminal errors, let it retry on the next interval
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
