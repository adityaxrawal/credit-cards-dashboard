/**
 * API Client with httpOnly cookie authentication
 * Secure, type-safe API calls with automatic retry on 401
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
 * API Error class
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
 * Request options
 */
interface RequestOptions extends RequestInit {
  retry?: boolean;
  csrfToken?: string;
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
 * Make an API request
 * Uses httpOnly cookies for authentication (no tokens in JS)
 * Automatically refreshes token on 401 and retries once
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { retry = true, csrfToken, ...fetchOptions } = options;

  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Merge any custom headers
  if (fetchOptions.headers) {
    const customHeaders = new Headers(fetchOptions.headers);
    customHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // Add CSRF token for state-changing requests
  if (
    csrfToken &&
    (fetchOptions.method === "POST" ||
      fetchOptions.method === "PUT" ||
      fetchOptions.method === "DELETE")
  ) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: "include", // Include httpOnly cookies
    });

    // Handle 401 Unauthorized - try to refresh token and retry
    if (response.status === 401 && retry && typeof window !== "undefined") {
      console.log("Access token expired, attempting refresh...");

      // Try to refresh the token
      const refreshSuccess = await refreshAccessToken();

      if (refreshSuccess) {
        console.log("Token refreshed successfully, retrying request...");

        // Retry the original request with new token (disable retry to prevent infinite loop)
        return makeRequest<T>(endpoint, { ...options, retry: false });
      } else {
        // Refresh failed, redirect to login
        console.log("Token refresh failed, redirecting to login...");
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        throw new ApiError(401, "Session expired. Please login again.", null);
      }
    }

    // If this was a retry that still failed with 401, throw error
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

    if (!data.success) {
      throw new ApiError(
        response.status,
        data.error || data.message || "Request failed",
        data
      );
    }

    return data.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
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
 * Type-safe API endpoints
 */

// Auth endpoints
export interface AuthMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
    gmailConnected: boolean;
    isAdmin?: boolean;
    monthlyBudget?: number;
  };
}

export interface GmailSyncResponse {
  newTransactions: number;
  duplicatesSkipped: number;
  nextRecommendedSync: string;
}

export interface BudgetStatusResponse {
  currentSpend: number;
  budgetLimit: number;
  utilization: number;
  remainingBudget: number;
  period: string;
}

export interface Card {
  id: string;
  userId: string;
  lastFour: string;
  bank: string;
  network: string;
  creditLimit?: number;
  billingCycle?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  cardId?: string;
  amount: number;
  merchant: string;
  category?: string;
  transactionDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// API wrapper functions with typed responses
export const api = {
  // Auth
  getMe: () => apiGet<AuthMeResponse>("/api/auth/me"),

  // Gmail
  syncGmail: () => apiPost<GmailSyncResponse>("/api/gmail/sync"),

  // Services
  updateBudget: () => apiPost<void>("/api/services/update-budget"),
  checkAlerts: () => apiPost<void>("/api/services/check-alerts"),
  refreshAnalytics: () => apiPost<void>("/api/services/refresh-analytics"),
  getBudgetStatus: () =>
    apiGet<BudgetStatusResponse>("/api/services/budget-status"),

  // Cards
  getCards: () => apiGet<Card[]>("/api/cards"),
  getCard: (id: string) => apiGet<Card>(`/api/cards/${id}`),

  // Transactions
  getTransactions: (params?: {
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.start_date) query.append("start_date", params.start_date);
    if (params?.end_date) query.append("end_date", params.end_date);
    if (params?.limit) query.append("limit", params.limit.toString());
    const endpoint = `/api/transactions${query.toString() ? "?" + query.toString() : ""}`;
    return apiGet<Transaction[]>(endpoint);
  },
  getTransaction: (id: string) =>
    apiGet<Transaction>(`/api/transactions/${id}`),
};

export default api;
