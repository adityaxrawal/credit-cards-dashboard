/**
 * API Client - Legacy Axios Compatibility Layer
 * 
 * This file provides backward compatibility for code that imports from '@/lib/api-client'.
 * Internally delegates to the unified fetch-based client.
 * 
 * Part of Issue #10: Frontend API Layer Consolidation
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  ApiResponse as CoreApiResponse,
  ApiError,
  clearCsrfToken
} from "@/lib/api/core/client";

// Re-export the canonical ApiResponse type
export type { CoreApiResponse as ApiResponse };

/**
 * Enhanced API request with cold start handling
 * Kept for special cases requiring raw Response object
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000); // 45s for cold start

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""}${endpoint}`,
      {
        ...options,
        signal: controller.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      }
    );
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Service starting up, please try again in 30 seconds");
    }
    throw error;
  }
}

/**
 * API Client Class
 * Wraps the fetch-based unified client with an Axios-like interface
 */
class ApiClient {
  private isRedirecting = false;

  /**
   * GET request
   */
  async get<T>(
    url: string,
    params?: Record<string, unknown>
  ): Promise<{ success: boolean; data: T }> {
    // Build query string if params provided
    let endpoint = url;
    if (params && Object.keys(params).length > 0) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
      endpoint = `${url}?${query.toString()}`;
    }

    const data = await apiGet<T>(endpoint);
    return { success: true, data };
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown): Promise<{ success: boolean; data: T }> {
    const result = await apiPost<T>(url, data);
    return { success: true, data: result };
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown): Promise<{ success: boolean; data: T }> {
    const result = await apiPut<T>(url, data);
    return { success: true, data: result };
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<{ success: boolean; data: T }> {
    const result = await apiDelete<T>(url);
    return { success: true, data: result };
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown): Promise<{ success: boolean; data: T }> {
    const result = await apiPatch<T>(url, data);
    return { success: true, data: result };
  }

  /**
   * Get raw client (for special cases)
   * @deprecated Use the unified client methods instead
   */
  getClient() {
    console.warn("getClient() is deprecated. Use apiClient methods directly.");
    return null;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
