import axios, { AxiosInstance, AxiosResponse } from "axios";
import { ApiResponse } from "@/types";

/**
 * Enhanced API request with cold start handling
 * Supports 45s timeout for Cloud Run cold starts
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000); // 45s for cold start

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || ""
      }${endpoint}`,
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

class ApiClient {
  private client: AxiosInstance;
  private isAuthCheckInProgress = false;
  private isRedirecting = false;
  private csrfToken: string | null = null;
  private isFetchingCsrfToken = false;
  private csrfTokenPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true, // For httpOnly cookies
      timeout: 45000, // 45s timeout for cold starts
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        console.log(`[API] Request: ${config.method?.toUpperCase()} ${config.url}`);
        // Add auth token if available (backend uses 'accessToken' cookie)
        if (typeof window !== "undefined") {
          // Add CSRF token for non-GET requests
          if (config.method !== "get" && !config.url?.includes("/api/csrf-token") && !config.url?.includes("/api/auth/google")) {
            const token = await this.getCsrfToken();
            if (token && config.headers) {
              config.headers["X-CSRF-Token"] = token;
            }
          }

          const token = document.cookie
            .split("; ")
            .find((row) => row.startsWith("accessToken="))
            ?.split("=")[1];

          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Mark auth check requests to prevent loops
          if (config.url?.includes("/api/auth/me")) {
            if (this.isAuthCheckInProgress) {
              console.log(
                "🔄 Auth check already in progress, skipping duplicate request"
              );
              return Promise.reject(
                new axios.Cancel("Auth check already in progress")
              );
            }
            this.isAuthCheckInProgress = true;
            console.log("🔐 Starting auth check request");
          }
        }
        return config;
      },
      (error) => {
        this.isAuthCheckInProgress = false;
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse<unknown>>) => {
        console.log(`[API] Response: ${response.status} ${response.config.url}`);
        // Clear auth check flag on success
        if (response.config.url?.includes("/api/auth/me")) {
          this.isAuthCheckInProgress = false;
          console.log("✅ Auth check completed successfully");
        }
        return response;
      },
      async (error) => {
        console.error(`[API] Error: ${error.message} for ${error.config?.url}`);
        // Clear auth check flag on error
        if (error.config?.url?.includes("/api/auth/me")) {
          this.isAuthCheckInProgress = false;
        }

        // Handle cancelled requests (duplicate auth checks)
        if (axios.isCancel(error)) {
          return Promise.reject(error);
        }

        // Dynamically import toast to avoid SSR issues
        const { toastService } = await import("@/lib/utils/toast");

        if (error.response?.status === 403 && error.response?.data?.error?.code === "CSRF_ERROR") {
          console.warn("🔐 CSRF error detected, refreshing token...");
          this.csrfToken = null;
          this.csrfTokenPromise = null;

          // If we have original request, we could retry here, 
          // but for now let's just clear it so next request succeeds
        }

        if (error.response?.status === 401) {
          // Only redirect to login if not already redirecting and not on login page
          if (typeof window !== "undefined" && !this.isRedirecting) {
            const isOnLoginPage =
              window.location.pathname === "/login" ||
              window.location.pathname === "/callback";

            if (!isOnLoginPage) {
              this.isRedirecting = true;
              toastService.error("Session expired. Please login again.");

              // Wait a moment before redirecting
              setTimeout(() => {
                window.location.href = "/login";
                // Reset flag after redirect starts
                setTimeout(() => {
                  this.isRedirecting = false;
                }, 2000);
              }, 1000);
            } else {
              // On login page, don't show toast or redirect
              console.log("❌ Auth check failed on login page (expected)");
            }
          }
        } else if (
          error.code === "ECONNABORTED" ||
          error.message?.includes("timeout")
        ) {
          toastService.error(
            "Request timeout. The server might be starting up, please try again."
          );
        } else if (!error.response) {
          toastService.error("Network error. Please check your connection.");
        } else {
          // Don't show toast for every error - let components handle it
          // This prevents duplicate toasts
          // toastService.handleApiError(error);
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic methods
  async get<T>(
    url: string,
    params?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data);
    return response.data;
  }

  // CSRF Handling
  private async getCsrfToken(): Promise<string | null> {
    if (this.csrfToken) return this.csrfToken;
    if (this.csrfTokenPromise) return this.csrfTokenPromise;

    console.log("📡 Fetching new CSRF token");
    this.csrfTokenPromise = this.client
      .get<ApiResponse<{ csrfToken: string }>>("/api/csrf-token")
      .then((response) => {
        this.csrfToken = response.data.data?.csrfToken || null;
        this.csrfTokenPromise = null;
        console.log("✅ CSRF token fetched successfully");
        return this.csrfToken;
      })
      .catch((err) => {
        console.error("❌ Failed to fetch CSRF token:", err);
        this.csrfTokenPromise = null;
        return null;
      });

    return this.csrfTokenPromise;
  }

  // Raw client access for special cases
  getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
