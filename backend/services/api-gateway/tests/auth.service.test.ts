import { AuthService } from "../src/services/auth.service";
import { supabase } from "shared/database/supabase";
import redis from "shared/cache/redis";
import jwt from "jsonwebtoken";
import { google } from "googleapis";

// Mock dependencies
jest.mock("shared/database/supabase");
jest.mock("shared/cache/redis");
jest.mock("googleapis");

describe("AuthService", () => {
  let authService: AuthService;
  const mockUser = {
    id: "user-123",
    google_id: "google-456",
    email: "test@example.com",
    name: "Test User",
    profile_picture: "https://example.com/pic.jpg",
    is_active: true,
    monthly_budget: 30000,
  };

  beforeEach(() => {
    // Set required environment variables
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/login";
    process.env.JWT_SECRET = "test-jwt-secret-key-min-32-chars-long";
    process.env.JWT_REFRESH_SECRET =
      "test-jwt-refresh-secret-min-32-chars-long";
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe("googleOAuth", () => {
    const mockCode = "test-auth-code";
    const mockTokens = {
      access_token: "access-token",
      refresh_token: "refresh-token",
      scope: "email profile",
      token_type: "Bearer",
      expiry_date: Date.now() + 3600000,
    };

    const mockUserInfo = {
      id: "google-456",
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/pic.jpg",
    };

    beforeEach(() => {
      // Mock OAuth2Client
      const mockOAuth2 = {
        getToken: jest.fn().mockResolvedValue({ tokens: mockTokens }),
        setCredentials: jest.fn(),
      };

      (google.auth.OAuth2 as jest.Mock) = jest
        .fn()
        .mockImplementation(() => mockOAuth2);

      // Mock google.oauth2 userinfo
      (google.oauth2 as jest.Mock) = jest.fn().mockReturnValue({
        userinfo: {
          get: jest.fn().mockResolvedValue({ data: mockUserInfo }),
        },
      });

      // Mock Supabase upsert
      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      });

      // Mock Redis set
      (redis.set as jest.Mock) = jest.fn().mockResolvedValue("OK");
    });

    it("should successfully authenticate with Google OAuth code", async () => {
      const result = await authService.googleOAuth(mockCode);

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("user");
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.id).toBe(mockUser.id);
    });

    it("should store user in database", async () => {
      await authService.googleOAuth(mockCode);

      expect(supabase.from).toHaveBeenCalledWith("users");
    });

    it("should store session in Redis with 7-day expiry", async () => {
      await authService.googleOAuth(mockCode);

      expect(redis.set).toHaveBeenCalledWith(
        `session:${mockUser.id}`,
        expect.any(String),
        "EX",
        7 * 24 * 60 * 60
      );
    });

    it("should throw error if code is invalid", async () => {
      const mockOAuth2 = {
        getToken: jest.fn().mockRejectedValue(new Error("Invalid code")),
        setCredentials: jest.fn(),
      };
      (google.auth.OAuth2 as jest.Mock) = jest
        .fn()
        .mockImplementation(() => mockOAuth2);

      await expect(authService.googleOAuth("invalid-code")).rejects.toThrow(
        "Authentication failed"
      );
    });

    it("should throw error if user info is incomplete", async () => {
      (google.oauth2 as jest.Mock) = jest.fn().mockReturnValue({
        userinfo: {
          get: jest.fn().mockResolvedValue({ data: { id: "google-456" } }), // Missing email
        },
      });

      await expect(authService.googleOAuth(mockCode)).rejects.toThrow();
    });

    it("should throw error if database upsert fails", async () => {
      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({
                data: null,
                error: { message: "DB Error" },
              }),
          }),
        }),
      });

      await expect(authService.googleOAuth(mockCode)).rejects.toThrow();
    });
  });

  describe("generateAccessToken", () => {
    it("should generate valid JWT access token with 15m expiry", () => {
      const token = authService["generateAccessToken"](mockUser);

      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe("access");

      // Check expiry is approximately 15 minutes
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBeGreaterThanOrEqual(14 * 60);
      expect(expiresIn).toBeLessThanOrEqual(16 * 60);
    });

    it("should throw error if JWT_SECRET is missing", () => {
      delete process.env.JWT_SECRET;

      expect(() => authService["generateAccessToken"](mockUser)).toThrow(
        "JWT_SECRET"
      );
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate valid JWT refresh token with 7d expiry", () => {
      const token = authService["generateRefreshToken"](mockUser);

      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe("refresh");

      // Check expiry is approximately 7 days
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 - 60);
      expect(expiresIn).toBeLessThanOrEqual(7 * 24 * 60 * 60 + 60);
    });

    it("should throw error if JWT_REFRESH_SECRET is missing", () => {
      delete process.env.JWT_REFRESH_SECRET;

      expect(() => authService["generateRefreshToken"](mockUser)).toThrow(
        "JWT_REFRESH_SECRET"
      );
    });
  });

  describe("refreshAccessToken", () => {
    it("should generate new access token with valid refresh token", async () => {
      const refreshToken = authService["generateRefreshToken"](mockUser);

      (redis.get as jest.Mock) = jest.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: "old-access-token",
          refreshToken,
          createdAt: new Date().toISOString(),
        })
      );

      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      });

      (redis.set as jest.Mock) = jest.fn().mockResolvedValue("OK");

      const result = await authService.refreshAccessToken(refreshToken);

      expect(result).toHaveProperty("accessToken");
      expect(typeof result.accessToken).toBe("string");
      expect(redis.set).toHaveBeenCalled();
    });

    it("should throw error if refresh token is invalid", async () => {
      await expect(
        authService.refreshAccessToken("invalid-token")
      ).rejects.toThrow();
    });

    it("should throw error if token type is not refresh", async () => {
      const accessToken = authService["generateAccessToken"](mockUser);

      await expect(authService.refreshAccessToken(accessToken)).rejects.toThrow(
        "Invalid token type"
      );
    });

    it("should throw error if session does not exist", async () => {
      const refreshToken = authService["generateRefreshToken"](mockUser);
      (redis.get as jest.Mock) = jest.fn().mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken(refreshToken)
      ).rejects.toThrow("Session expired");
    });

    it("should throw error if user is inactive", async () => {
      const refreshToken = authService["generateRefreshToken"](mockUser);

      (redis.get as jest.Mock) = jest.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: "token",
          refreshToken,
        })
      );

      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockUser, is_active: false },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        authService.refreshAccessToken(refreshToken)
      ).rejects.toThrow("inactive");
    });
  });

  describe("logout", () => {
    it("should remove session from Redis", async () => {
      (redis.del as jest.Mock) = jest.fn().mockResolvedValue(1);

      await authService.logout(mockUser.id);

      expect(redis.del).toHaveBeenCalledWith(`session:${mockUser.id}`);
    });

    it("should handle Redis errors gracefully", async () => {
      (redis.del as jest.Mock) = jest
        .fn()
        .mockRejectedValue(new Error("Redis error"));

      await expect(authService.logout(mockUser.id)).rejects.toThrow(
        "Logout failed"
      );
    });
  });

  describe("getUserInfo", () => {
    it("should return user information", async () => {
      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      });

      const result = await authService.getUserInfo(mockUser.id);

      expect(result).toHaveProperty("id", mockUser.id);
      expect(result).toHaveProperty("email", mockUser.email);
      expect(result).toHaveProperty("name", mockUser.name);
    });

    it("should throw error if user not found", async () => {
      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest
              .fn()
              .mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
          }),
        }),
      });

      await expect(authService.getUserInfo("invalid-id")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("verifyToken", () => {
    it("should verify valid access token", async () => {
      const accessToken = authService["generateAccessToken"](mockUser);

      const result = await authService.verifyToken(accessToken, "access");

      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.type).toBe("access");
    });

    it("should verify valid refresh token", async () => {
      const refreshToken = authService["generateRefreshToken"](mockUser);

      const result = await authService.verifyToken(refreshToken, "refresh");

      expect(result.userId).toBe(mockUser.id);
      expect(result.type).toBe("refresh");
    });

    it("should throw error for invalid token", async () => {
      await expect(
        authService.verifyToken("invalid-token", "access")
      ).rejects.toThrow();
    });

    it("should throw error for mismatched token type", async () => {
      const accessToken = authService["generateAccessToken"](mockUser);

      await expect(
        authService.verifyToken(accessToken, "refresh")
      ).rejects.toThrow("Invalid token type");
    });

    it("should throw error for expired token", async () => {
      // Create expired token
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email, type: "access" },
        process.env.JWT_SECRET!,
        { expiresIn: "-1s" }
      );

      await expect(
        authService.verifyToken(expiredToken, "access")
      ).rejects.toThrow();
    });
  });
});
