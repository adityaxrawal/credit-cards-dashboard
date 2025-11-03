import request from "supertest";
import express, { Express } from "express";
import authRoutes from "../src/routes/auth.routes";
import { AuthService } from "../src/services/auth.service";
import redis from "shared/cache/redis";
import jwt from "jsonwebtoken";

// Mock dependencies
jest.mock("shared/cache/redis");

describe("Auth Routes Integration Tests", () => {
  let app: Express;
  let mockAuthService: jest.Mocked<AuthService>;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    profilePicture: "https://example.com/pic.jpg",
    monthlyBudget: 30000,
    createdAt: new Date().toISOString(),
  };

  const mockTokens = {
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    user: mockUser,
  };

  beforeEach(() => {
    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);

    // Setup environment
    process.env.JWT_SECRET = "test-jwt-secret-key-min-32-chars-long";
    process.env.JWT_REFRESH_SECRET =
      "test-jwt-refresh-secret-min-32-chars-long";

    // Mock AuthService
    mockAuthService = {
      googleOAuth: jest.fn(),
      refreshAccessToken: jest.fn(),
      logout: jest.fn(),
      getUserInfo: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyToken: jest.fn(),
    } as any;

    (AuthService as jest.MockedClass<typeof AuthService>).mockImplementation(
      () => mockAuthService
    );

    jest.clearAllMocks();
  });

  describe("POST /api/auth/google", () => {
    it("should authenticate successfully with valid code", async () => {
      mockAuthService.googleOAuth.mockResolvedValue(mockTokens);

      const response = await request(app)
        .post("/api/auth/google")
        .send({ code: "valid-auth-code" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data.user.email).toBe(mockUser.email);
    });

    it("should return 400 if code is missing", async () => {
      const response = await request(app)
        .post("/api/auth/google")
        .send({})
        .expect(400);

      expect(response.body.error).toContain("required");
      expect(mockAuthService.googleOAuth).not.toHaveBeenCalled();
    });

    it("should return 401 if authentication fails", async () => {
      mockAuthService.googleOAuth.mockRejectedValue(new Error("Invalid code"));

      const response = await request(app)
        .post("/api/auth/google")
        .send({ code: "invalid-code" })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should handle database errors", async () => {
      mockAuthService.googleOAuth.mockRejectedValue(
        new Error("Database connection failed")
      );

      const response = await request(app)
        .post("/api/auth/google")
        .send({ code: "valid-code" })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh access token successfully", async () => {
      mockAuthService.refreshAccessToken.mockResolvedValue({
        accessToken: "new-access-token",
      });

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "valid-refresh-token" })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBe("new-access-token");
    });

    it("should return 400 if refresh token is missing", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body.error).toContain("required");
      expect(mockAuthService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should return 401 if refresh token is invalid", async () => {
      mockAuthService.refreshAccessToken.mockRejectedValue(
        new Error("Invalid token")
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should return 401 if session expired", async () => {
      mockAuthService.refreshAccessToken.mockRejectedValue(
        new Error("Session expired")
      );

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "expired-token" })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully with valid token", async () => {
      const accessToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      (redis.get as jest.Mock) = jest
        .fn()
        .mockResolvedValue(JSON.stringify({ accessToken }));
      mockAuthService.logout.mockResolvedValue();

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Logged out");
    });

    it("should return 401 if no token provided", async () => {
      const response = await request(app).post("/api/auth/logout").expect(401);

      expect(response.body.error).toBeDefined();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it("should return 401 if token is invalid", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it("should return 401 if session does not exist", async () => {
      const accessToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      (redis.get as jest.Mock) = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.error).toContain("Session expired");
    });

    it("should handle logout errors gracefully", async () => {
      const accessToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      (redis.get as jest.Mock) = jest
        .fn()
        .mockResolvedValue(JSON.stringify({ accessToken }));
      mockAuthService.logout.mockRejectedValue(new Error("Redis error"));

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user info with valid token", async () => {
      const accessToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      (redis.get as jest.Mock) = jest
        .fn()
        .mockResolvedValue(JSON.stringify({ accessToken }));
      mockAuthService.getUserInfo.mockResolvedValue(mockUser);

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("id", mockUser.id);
      expect(response.body.data).toHaveProperty("email", mockUser.email);
    });

    it("should return 401 if no token provided", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body.error).toBeDefined();
      expect(mockAuthService.getUserInfo).not.toHaveBeenCalled();
    });

    it("should return 401 if token is expired", async () => {
      const expiredToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "-1h" }
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`)
        .expect(401);

      expect(mockAuthService.getUserInfo).not.toHaveBeenCalled();
    });

    it("should return 404 if user not found", async () => {
      const accessToken = jwt.sign(
        { userId: "non-existent-user", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      (redis.get as jest.Mock) = jest
        .fn()
        .mockResolvedValue(JSON.stringify({ accessToken }));
      mockAuthService.getUserInfo.mockRejectedValue(
        new Error("User not found")
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe("Authentication Flow Integration", () => {
    it("should complete full authentication flow", async () => {
      // Step 1: Login
      mockAuthService.googleOAuth.mockResolvedValue(mockTokens);

      const loginResponse = await request(app)
        .post("/api/auth/google")
        .send({ code: "valid-code" })
        .expect(200);

      const { accessToken, refreshToken } = loginResponse.body.data;

      // Step 2: Access protected route
      (redis.get as jest.Mock) = jest
        .fn()
        .mockResolvedValue(JSON.stringify({ accessToken, refreshToken }));
      mockAuthService.getUserInfo.mockResolvedValue(mockUser);

      const meResponse = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.data.email).toBe(mockUser.email);

      // Step 3: Refresh token
      mockAuthService.refreshAccessToken.mockResolvedValue({
        accessToken: "new-access-token",
      });

      const refreshResponse = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.data.accessToken).toBeDefined();

      // Step 4: Logout
      mockAuthService.logout.mockResolvedValue();

      await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe("Security Tests", () => {
    it("should not accept malformed tokens", async () => {
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer malformed.token.here")
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should not accept tokens with wrong signature", async () => {
      const fakeToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        "wrong-secret",
        { expiresIn: "15m" }
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${fakeToken}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it("should not accept tokens without Bearer prefix", async () => {
      const accessToken = jwt.sign(
        { userId: "user-123", email: "test@example.com" },
        process.env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", accessToken) // Missing "Bearer "
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });
});
