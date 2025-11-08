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
  // Clear any existing timer
  stopTokenRefresh();

  // Refresh every 14 minutes (access token expires in 15 minutes)
  const refreshInterval = 14 * 60 * 1000;

  refreshTimer = setInterval(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include", // Send httpOnly refresh token cookie
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      if (data.success && onRefreshSuccess) {
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

  // Also do an immediate refresh check
  setTimeout(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok && onRefreshSuccess) {
        onRefreshSuccess();
      }
    } catch (error) {
      console.error("Initial token refresh check failed:", error);
    }
  }, 1000);
}

/**
 * Stop automatic token refresh
 */
export function stopTokenRefresh() {
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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.ok;
  } catch (error) {
    console.error("Manual token refresh failed:", error);
    return false;
  }
}
