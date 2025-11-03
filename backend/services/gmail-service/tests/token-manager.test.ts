import { TokenManager } from "../src/token-manager";
import { OAuth2Client } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

// Mock dependencies
jest.mock("@supabase/supabase-js");
jest.mock("google-auth-library");

describe("TokenManager", () => {
  let tokenManager: TokenManager;
  let mockOAuth2Client: any;
  let mockSupabase: any;

  beforeEach(() => {
    // Setup environment
    process.env.ENCRYPTION_KEY = "test_encryption_key_32_chars_min";
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_KEY = "test_key";

    // Mock OAuth2Client
    mockOAuth2Client = {
      setCredentials: jest.fn(),
      refreshAccessToken: jest.fn(),
      revokeToken: jest.fn(),
    } as any;

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    tokenManager = new TokenManager(mockOAuth2Client);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("storeTokens", () => {
    it("should encrypt and store tokens successfully", async () => {
      const userId = "test-user-id";
      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiryDate: Date.now() + 3600000, // 1 hour from now
      };

      mockSupabase.single.mockResolvedValue({ data: {}, error: null });

      await tokenManager.storeTokens(userId, tokens);

      expect(mockSupabase.from).toHaveBeenCalledWith("users");
      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", userId);

      // Verify update was called with encrypted data
      const updateCall = mockSupabase.update.mock.calls[0][0];
      expect(updateCall.gmail_refresh_token).toBeDefined();
      expect(updateCall.gmail_refresh_token).not.toBe(tokens.refreshToken); // Should be encrypted
      expect(updateCall.gmail_access_token).toBe(tokens.accessToken);
    });

    it("should throw error if database update fails", async () => {
      const userId = "test-user-id";
      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiryDate: Date.now() + 3600000,
      };

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      });

      await expect(tokenManager.storeTokens(userId, tokens)).rejects.toThrow();
    });
  });

  describe("getTokens", () => {
    it("should retrieve and decrypt tokens successfully", async () => {
      const userId = "test-user-id";
      const refreshToken = "test_refresh_token";

      // First store tokens to get encrypted format
      const tokens = {
        accessToken: "test_access_token",
        refreshToken,
        expiryDate: Date.now() + 3600000,
      };

      mockSupabase.single.mockResolvedValue({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      // Get the encrypted token from the update call
      const updateCall = mockSupabase.update.mock.calls[0][0];
      const encryptedRefreshToken = updateCall.gmail_refresh_token;

      // Mock retrieval
      mockSupabase.single.mockResolvedValue({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      const retrieved = await tokenManager.getTokens(userId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.accessToken).toBe(tokens.accessToken);
      expect(retrieved?.refreshToken).toBe(refreshToken); // Should be decrypted
    });

    it("should return null if user has no tokens", async () => {
      const userId = "test-user-id";

      mockSupabase.single.mockResolvedValue({
        data: { gmail_refresh_token: null },
        error: null,
      });

      const retrieved = await tokenManager.getTokens(userId);

      expect(retrieved).toBeNull();
    });

    it("should return null if user not found", async () => {
      const userId = "test-user-id";

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error("User not found"),
      });

      const retrieved = await tokenManager.getTokens(userId);

      expect(retrieved).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for valid token", () => {
      const futureExpiry = Date.now() + 3600000; // 1 hour from now
      expect(tokenManager.isTokenExpired(futureExpiry)).toBe(false);
    });

    it("should return true for expired token", () => {
      const pastExpiry = Date.now() - 3600000; // 1 hour ago
      expect(tokenManager.isTokenExpired(pastExpiry)).toBe(true);
    });

    it("should return true for token expiring within 5 minutes", () => {
      const soonExpiry = Date.now() + 4 * 60 * 1000; // 4 minutes from now
      expect(tokenManager.isTokenExpired(soonExpiry)).toBe(true);
    });

    it("should return false for token expiring after 5 minutes", () => {
      const laterExpiry = Date.now() + 6 * 60 * 1000; // 6 minutes from now
      expect(tokenManager.isTokenExpired(laterExpiry)).toBe(false);
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh token successfully", async () => {
      const userId = "test-user-id";
      const refreshToken = "test_refresh_token";
      const newAccessToken = "new_access_token";
      const newExpiryDate = Date.now() + 3600000;

      // Setup existing tokens
      const tokens = {
        accessToken: "old_access_token",
        refreshToken,
        expiryDate: Date.now() - 1000, // Expired
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      // Mock retrieval
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      // Mock refresh
      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: newAccessToken,
          expiry_date: newExpiryDate,
        },
        res: null,
      });

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const result = await tokenManager.refreshAccessToken(userId);

      expect(result.accessToken).toBe(newAccessToken);
      expect(result.expiryDate).toBe(newExpiryDate);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: refreshToken,
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it("should throw error if no tokens found", async () => {
      const userId = "test-user-id";

      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(tokenManager.refreshAccessToken(userId)).rejects.toThrow(
        "No tokens found for user"
      );
    });

    it("should throw error if refresh fails", async () => {
      const userId = "test-user-id";
      const refreshToken = "test_refresh_token";

      const tokens = {
        accessToken: "old_access_token",
        refreshToken,
        expiryDate: Date.now() - 1000,
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      mockOAuth2Client.refreshAccessToken.mockRejectedValue(
        new Error("Refresh failed")
      );

      await expect(tokenManager.refreshAccessToken(userId)).rejects.toThrow();
    });
  });

  describe("getValidAccessToken", () => {
    it("should return existing token if not expired", async () => {
      const userId = "test-user-id";
      const accessToken = "valid_access_token";

      const tokens = {
        accessToken,
        refreshToken: "refresh_token",
        expiryDate: Date.now() + 3600000, // 1 hour from now
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      const result = await tokenManager.getValidAccessToken(userId);

      expect(result).toBe(accessToken);
      expect(mockOAuth2Client.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should refresh token if expired", async () => {
      const userId = "test-user-id";
      const newAccessToken = "new_access_token";

      const tokens = {
        accessToken: "old_access_token",
        refreshToken: "refresh_token",
        expiryDate: Date.now() - 1000, // Expired
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: newAccessToken,
          expiry_date: Date.now() + 3600000,
        },
        res: null,
      });

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const result = await tokenManager.getValidAccessToken(userId);

      expect(result).toBe(newAccessToken);
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe("revokeTokens", () => {
    it("should revoke tokens successfully", async () => {
      const userId = "test-user-id";
      const refreshToken = "test_refresh_token";

      const tokens = {
        accessToken: "test_access_token",
        refreshToken,
        expiryDate: Date.now() + 3600000,
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      mockOAuth2Client.revokeToken.mockResolvedValue({
        success: true,
        data: {},
      } as any);

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      await tokenManager.revokeTokens(userId);

      expect(mockOAuth2Client.revokeToken).toHaveBeenCalledWith(refreshToken);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          gmail_refresh_token: null,
          gmail_access_token: null,
          gmail_token_expiry: null,
        })
      );
    });

    it("should clear tokens even if revocation fails", async () => {
      const userId = "test-user-id";
      const refreshToken = "test_refresh_token";

      const tokens = {
        accessToken: "test_access_token",
        refreshToken,
        expiryDate: Date.now() + 3600000,
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      mockOAuth2Client.revokeToken.mockRejectedValue(
        new Error("Revocation failed")
      );

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      // Should not throw
      await tokenManager.revokeTokens(userId);

      // Should still clear tokens from database
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          gmail_refresh_token: null,
        })
      );
    });
  });

  describe("hasValidTokens", () => {
    it("should return true if user has tokens", async () => {
      const userId = "test-user-id";

      const tokens = {
        accessToken: "test_access_token",
        refreshToken: "test_refresh_token",
        expiryDate: Date.now() + 3600000,
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedRefreshToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      const result = await tokenManager.hasValidTokens(userId);

      expect(result).toBe(true);
    });

    it("should return false if user has no tokens", async () => {
      const userId = "test-user-id";

      mockSupabase.single.mockResolvedValue({
        data: { gmail_refresh_token: null },
        error: null,
      });

      const result = await tokenManager.hasValidTokens(userId);

      expect(result).toBe(false);
    });

    it("should return false on error", async () => {
      const userId = "test-user-id";

      mockSupabase.single.mockRejectedValue(new Error("Database error"));

      const result = await tokenManager.hasValidTokens(userId);

      expect(result).toBe(false);
    });
  });

  describe("encryption/decryption", () => {
    it("should encrypt and decrypt consistently", async () => {
      const userId = "test-user-id";
      const originalToken = "test_refresh_token_with_special_chars_!@#$%";

      const tokens = {
        accessToken: "test_access_token",
        refreshToken: originalToken,
        expiryDate: Date.now() + 3600000,
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });
      await tokenManager.storeTokens(userId, tokens);

      const encryptedToken =
        mockSupabase.update.mock.calls[0][0].gmail_refresh_token;

      // Encrypted should be different
      expect(encryptedToken).not.toBe(originalToken);

      // Should have format: iv:authTag:encryptedData
      expect(encryptedToken.split(":")).toHaveLength(3);

      // Mock retrieval with encrypted token
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          gmail_refresh_token: encryptedToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        },
        error: null,
      });

      const retrieved = await tokenManager.getTokens(userId);

      // Decrypted should match original
      expect(retrieved?.refreshToken).toBe(originalToken);
    });
  });
});
