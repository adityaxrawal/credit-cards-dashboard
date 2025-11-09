"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { startTokenRefresh, stopTokenRefresh } from "./token-refresh";
import { apiClient } from "@/lib/api-client";

/**
 * User interface matching backend response
 */
export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  monthlyBudget?: number;
}

/**
 * Authentication context interface
 */
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isAuthenticated: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component
 * Manages authentication state and provides auth methods to the app
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start token refresh when user is authenticated
  useEffect(() => {
    if (user) {
      startTokenRefresh(
        () => {
          // On successful refresh, just continue
          console.log("Token refreshed successfully");
        },
        (error) => {
          // On refresh error, clear user and redirect to login
          console.error("Token refresh failed, logging out:", error);
          setUser(null);
          setError("Session expired. Please login again.");
          router.push("/login");
        }
      );
    } else {
      stopTokenRefresh();
    }

    return () => {
      stopTokenRefresh();
    };
  }, [user, router]);

  /**
   * Check if user is authenticated by verifying httpOnly cookie
   */
  async function checkAuth() {
    try {
      const data = await apiClient.get("/api/auth/me");
      setUser(data.data.user);
    } catch (error: any) {
      if (error?.response?.status === 401) {
        // Not authenticated
        setUser(null);
      } else {
        console.error("Auth check failed:", error);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  /**
   * Login with Google OAuth authorization code
   * @param code - Authorization code from Google OAuth
   */
  async function login(code: string) {
    try {
      const data = await apiClient.post("/api/auth/google", { code });

      if (!data.success || !data.data?.user) {
        throw new Error("Invalid response from server");
      }

      // Set user state (tokens are in httpOnly cookies set by backend)
      setUser(data.data.user);

      console.log("Login successful, redirecting to dashboard");

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Logout user and clear authentication state
   */
  async function logout() {
    try {
      // Call logout endpoint (httpOnly cookie sent automatically)
      await apiClient.post("/api/auth/logout", {});
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      // Clear local state regardless of API call result
      setUser(null);
      router.push("/login");
    }
  }

  /**
   * Refresh token - not needed with httpOnly cookies
   * Backend handles token refresh automatically
   */
  async function refreshToken() {
    // With httpOnly cookies, token refresh is handled by backend
    // Just re-check authentication status
    await checkAuth();
  }

  /**
   * Clear error message
   */
  function clearError() {
    setError(null);
  }

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use authentication context
 * Must be used within AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
