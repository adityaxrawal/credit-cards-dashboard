"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

/**
 * User interface matching backend response
 */
interface User {
  id: string;
  email: string;
  name: string;
  profilePicture: string;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component
 * Manages authentication state and provides auth methods to the app
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Check if user is authenticated by verifying httpOnly cookie
   */
  async function checkAuth() {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
        {
          credentials: "include", // Send httpOnly cookie
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else if (response.status === 401) {
        // Not authenticated
        setUser(null);
      } else {
        // Other errors
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`,
        {
          method: "POST",
          credentials: "include", // Receive httpOnly cookie
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Authentication failed");
      }

      const data = await response.json();

      // Set user state (token is in httpOnly cookie set by backend)
      setUser(data.data.user);

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
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include", // Send httpOnly cookie
      });
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

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user,
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
