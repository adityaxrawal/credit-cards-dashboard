/**
 * Unified API Client
 * Consolidates fetch-based and axios-based clients into a single implementation
 * Uses httpOnly cookies for authentication with automatic token refresh
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// CSRF Token Management
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

/**
 * Fetch CSRF token from backend
 */
async function fetchCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  if (csrfTokenPromise) return csrfTokenPromise;

  console.log("📡 Fetching new CSRF token");
  csrfTokenPromise = fetch(`${API_URL}/api/csrf-token`, {
    method: "GET",
    credentials: "include",
  })
    .then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        csrfToken = data.data?.csrfToken || null;
        console.log("✅ CSRF token fetched successfully");
      }
      csrfTokenPromise = null;
      return csrfToken;
    })
    .catch((err) => {
      console.error("❌ Failed to fetch CSRF token:", err);
      csrfTokenPromise = null;
      return null;
    });

  return csrfTokenPromise;
}

/**
 * Clear CSRF token (call on CSRF errors)
 */
export function clearCsrfToken(): void {
  csrfToken = null;
  csrfTokenPromise = null;
}

/**
 * Base API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Request options extending standard RequestInit
 */
interface RequestOptions extends RequestInit {
  retry?: boolean;
  csrfToken?: string;
  timeout?: number;
  skipCsrf?: boolean;
}

/**
 * Refresh the access token using the refresh token cookie
 * @returns true if refresh successful, false otherwise
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return false;
  }
}

/**
 * Make an API request with automatic retry on 401
 * Uses httpOnly cookies for authentication (no tokens in JS)
 * Automatically refreshes token on 401 and retries once
 * Automatically includes CSRF token for state-changing requests
 * 
 * @param endpoint - API endpoint (e.g., "/api/cards")
 * @param options - Request options
 * @returns Parsed response data
 */
export async function makeRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { retry = true, csrfToken: providedCsrfToken, timeout = 45000, skipCsrf = false, ...fetchOptions } = options;

  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    // Only set Content-Type to JSON if not FormData
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
  };

  // Merge custom headers
  if (fetchOptions.headers) {
    const customHeaders = new Headers(fetchOptions.headers);
    customHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // Add CSRF token for state-changing requests (auto-fetch if not provided)
  const isStateChanging =
    fetchOptions.method === "POST" ||
    fetchOptions.method === "PUT" ||
    fetchOptions.method === "DELETE" ||
    fetchOptions.method === "PATCH";

  if (isStateChanging && !skipCsrf && !endpoint.includes("/api/csrf-token") && !endpoint.includes("/api/auth/google")) {
    const token = providedCsrfToken || await fetchCsrfToken();
    if (token) {
      headers["X-CSRF-Token"] = token;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include httpOnly cookies
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle CSRF errors
    if (response.status === 403) {
      const data = await response.clone().json().catch(() => ({}));
      if (data.error?.code === "CSRF_ERROR") {
        console.warn("🔐 CSRF error detected, refreshing token...");
        clearCsrfToken();
      }
    }

    // Handle 401 Unauthorized - try to refresh token and retry
    if (response.status === 401 && retry && typeof window !== "undefined") {
      console.log("[ApiClient] 401 received, attempting token refresh...");
      console.log(`[ApiClient] Current path: ${window.location.pathname}`);

      const refreshSuccess = await refreshAccessToken();

      if (refreshSuccess) {
        console.log("[ApiClient] ✅ Token refreshed successfully, retrying request...");
        // Retry with new token (disable retry to prevent infinite loop)
        return makeRequest<T>(endpoint, { ...options, retry: false });
      } else {
        console.log("[ApiClient] ❌ Token refresh failed");

        // IMPORTANT: Don't redirect if already on login page - this causes infinite loops
        const currentPath = window.location.pathname;
        if (currentPath === "/login") {
          console.log("[ApiClient] Already on login page, NOT redirecting (prevents infinite loop)");
          throw new ApiError(401, "Session expired. Please login again.", null);
        }

        // Redirect to login with next param
        const nextParam = encodeURIComponent(currentPath);
        console.log(`[ApiClient] 🔄 Redirecting to /login?next=${nextParam}`);
        window.location.href = `/login?next=${nextParam}`;
        throw new ApiError(401, "Session expired. Please login again.", null);
      }
    }

    // If retry already attempted and still 401
    if (response.status === 401 && !retry) {
      throw new ApiError(401, "Unauthorized", null);
    }

    // Handle other errors
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(
        response.status,
        errorData.error || errorData.message || "Request failed",
        errorData
      );
    }

    // Parse response
    const data: ApiResponse<T> = await response.json();

    if (data.success === false && data.error) {
      throw new ApiError(
        response.status,
        data.error || data.message || "Request failed",
        data
      );
    }

    // Return data.data if it exists AND success is defined (standard envelope), 
    // otherwise return the whole response (custom format like TransactionListResponse)
    if (data.success !== undefined && data.data !== undefined) {
      return data.data as T;
    }
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        0,
        "Request timeout. The server might be starting up, please try again.",
        null
      );
    }

    // Network or other errors
    throw new ApiError(
      0,
      error instanceof Error ? error.message : "Network error",
      null
    );
  }
}

/**
 * GET request
 */
export async function apiGet<T>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return makeRequest<T>(endpoint, {
    ...options,
    method: "GET",
  });
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return makeRequest<T>(endpoint, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return makeRequest<T>(endpoint, {
    ...options,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request
 */
export async function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  return makeRequest<T>(endpoint, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(
  endpoint: string,
  options?: RequestOptions
): Promise<T> {
  return makeRequest<T>(endpoint, {
    ...options,
    method: "DELETE",
  });
}

/**
 * Unified API client export
 */
export const apiClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
};

export default apiClient;
