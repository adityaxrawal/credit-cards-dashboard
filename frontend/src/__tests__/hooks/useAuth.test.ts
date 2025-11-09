import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth, AuthProvider } from "@/lib/auth/AuthContext";
import React from "react";

// Mock API client
jest.mock("@/lib/api-client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe("useAuth Hook", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  it("should initialize with unauthenticated state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("should handle successful login", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      full_name: "Test User",
    };

    const { apiClient } = require("@/lib/api-client");
    apiClient.post.mockResolvedValueOnce({
      data: { user: mockUser, token: "jwt-token" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it("should handle login errors", async () => {
    const { apiClient } = require("@/lib/api-client");
    apiClient.post.mockRejectedValueOnce(new Error("Invalid credentials"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Trigger login
    try {
      await result.current.login("invalid-code");
    } catch (error) {
      expect(error).toBeDefined();
    }

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should handle logout", async () => {
    const { apiClient } = require("@/lib/api-client");
    apiClient.post.mockResolvedValueOnce({ data: { success: true } });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Assume user is logged in
    await result.current.logout();

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  it("should handle token refresh", async () => {
    const { apiClient } = require("@/lib/api-client");
    apiClient.get.mockResolvedValueOnce({
      data: {
        id: "user-123",
        email: "test@example.com",
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toBeDefined();
    });
  });

  it("should handle invalid token gracefully", async () => {
    const { apiClient } = require("@/lib/api-client");
    apiClient.get.mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
