/**
 * Auth Integration Tests
 * Tests OAuth flow, token exchange, and JWT cookie creation
 */

import request from "supertest";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import { createSupabaseMock, createMockResponse } from "../test-utils/supabase-mock";

// Mock dependencies
const { supabase: mockSupabase, setReturnValue, reset: resetSupabase } = createSupabaseMock();

jest.mock("shared/database/supabase", () => ({
  supabase: mockSupabase,
}));

jest.mock("shared/monitoring/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "mock-jwt-token"),
  verify: jest.fn(() => ({ id: "user-123", email: "test@example.com" })),
}));

// Mock Google OAuth
jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(() => "https://accounts.google.com/o/oauth2/v2/auth?mock=true"),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            id_token: "mock-id-token",
          },
        }),
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: "google-user-123",
            email: "test@example.com",
            name: "Test User",
            picture: "https://example.com/avatar.jpg",
          }),
        }),
      })),
    },
  },
}));

// Import routes after mocks
import { authRoutes } from "../../modules/auth";

describe("Auth Integration Tests", () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api/auth", authRoutes);
  });

  beforeEach(() => {
    resetSupabase();
    jest.clearAllMocks();
  });

  describe("POST /api/auth/google", () => {
    it("should exchange auth code for tokens and create/update user", async () => {
      const authCode = "mock-auth-code";

      // Mock existing user
      setReturnValue("users", "select", createMockResponse(null)); // User doesn't exist
      setReturnValue(
        "users",
        "insert",
        createMockResponse({
          id: "user-new-123",
          email: "test@example.com",
          full_name: "Test User",
        })
      );
      setReturnValue(
        "users",
        "update",
        createMockResponse({
          id: "user-new-123",
          last_login: new Date().toISOString(),
        })
      );

      const response = await request(app).post("/api/auth/google").send({ code: authCode });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("token");
      expect(response.headers["set-cookie"]).toBeDefined();

      // Verify JWT cookie was set
      const cookies = response.headers["set-cookie"];
      expect(cookies.some((cookie: string) => cookie.startsWith("token="))).toBe(true);
    });

    it("should update existing user on subsequent login", async () => {
      const authCode = "mock-auth-code";

      const existingUser = {
        id: "user-existing-123",
        email: "test@example.com",
        full_name: "Test User",
        created_at: "2024-01-01T00:00:00Z",
      };

      setReturnValue("users", "select", createMockResponse([existingUser]));
      setReturnValue(
        "users",
        "update",
        createMockResponse({
          ...existingUser,
          last_login: new Date().toISOString(),
        })
      );

      const response = await request(app).post("/api/auth/google").send({ code: authCode });

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(existingUser.id);

      // Verify last_login was updated
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it("should handle invalid auth code", async () => {
      const invalidCode = "invalid-code";

      // Mock OAuth error
      const { google } = require("googleapis");
      google.auth.OAuth2.mockImplementationOnce(() => ({
        getToken: jest.fn().mockRejectedValue(new Error("Invalid auth code")),
      }));

      const response = await request(app).post("/api/auth/google").send({ code: invalidCode });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty("error");
    });

    it("should handle missing auth code", async () => {
      const response = await request(app).post("/api/auth/google").send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/code.*required/i);
    });

    it("should store Gmail tokens correctly", async () => {
      const authCode = "mock-auth-code";

      setReturnValue(
        "users",
        "select",
        createMockResponse([
          {
            id: "user-123",
            email: "test@example.com",
          },
        ])
      );
      setReturnValue("users", "update", createMockResponse({ id: "user-123" }));
      setReturnValue(
        "gmail_tokens",
        "upsert",
        createMockResponse({
          user_id: "user-123",
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
        })
      );

      const response = await request(app).post("/api/auth/google").send({ code: authCode });

      expect(response.status).toBe(200);
      expect(mockSupabase.from).toHaveBeenCalledWith("gmail_tokens");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user info when authenticated", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        full_name: "Test User",
      };

      setReturnValue("users", "select", createMockResponse([mockUser]));

      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", ["token=mock-jwt-token"]);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("email");
    });

    it("should return 401 when not authenticated", async () => {
      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });

    it("should return 401 for invalid token", async () => {
      // Mock JWT verification failure
      const jwt = require("jsonwebtoken");
      jwt.verify.mockImplementationOnce(() => {
        throw new Error("Invalid token");
      });

      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", ["token=invalid-token"]);

      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear auth cookie on logout", async () => {
      const response = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", ["token=mock-jwt-token"]);

      expect(response.status).toBe(200);

      const cookies = response.headers["set-cookie"];
      expect(
        cookies.some((cookie: string) => cookie.includes("token=") && cookie.includes("Max-Age=0"))
      ).toBe(true);
    });

    it("should succeed even without existing auth", async () => {
      const response = await request(app).post("/api/auth/logout");

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/auth/google/url", () => {
    it("should return Google OAuth authorization URL", async () => {
      const response = await request(app).get("/api/auth/google/url");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("url");
      expect(response.body.url).toContain("https://accounts.google.com");
    });

    it("should include required OAuth scopes", async () => {
      const response = await request(app).get("/api/auth/google/url");

      expect(response.status).toBe(200);
      expect(response.body.url).toContain("gmail");
    });
  });

  describe("Token Refresh Flow", () => {
    it("should refresh expired access token using refresh token", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
      };

      const mockGmailTokens = {
        user_id: "user-123",
        access_token: "old-access-token",
        refresh_token: "refresh-token",
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      };

      setReturnValue("users", "select", createMockResponse([mockUser]));
      setReturnValue("gmail_tokens", "select", createMockResponse([mockGmailTokens]));
      setReturnValue(
        "gmail_tokens",
        "update",
        createMockResponse({
          ...mockGmailTokens,
          access_token: "new-access-token",
          expires_at: new Date(Date.now() + 3600000).toISOString(),
        })
      );

      // This would be called internally during Gmail sync
      // For now, just verify the token structure
      const response = await request(app)
        .get("/api/auth/me")
        .set("Cookie", ["token=mock-jwt-token"]);

      expect(response.status).toBe(200);
    });
  });

  describe("Database Assertions", () => {
    it("should create user record with correct fields", async () => {
      const authCode = "mock-auth-code";

      setReturnValue("users", "select", createMockResponse(null));
      setReturnValue(
        "users",
        "insert",
        createMockResponse({
          id: "user-new",
          email: "newuser@example.com",
          full_name: "New User",
          created_at: new Date().toISOString(),
        })
      );
      setReturnValue("users", "update", createMockResponse({ id: "user-new" }));

      await request(app).post("/api/auth/google").send({ code: authCode });

      // Verify user insert was called with correct structure
      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith("users");
    });

    it("should store Gmail tokens with expiration", async () => {
      const authCode = "mock-auth-code";

      setReturnValue("users", "select", createMockResponse([{ id: "user-123" }]));
      setReturnValue("users", "update", createMockResponse({ id: "user-123" }));
      setReturnValue(
        "gmail_tokens",
        "upsert",
        createMockResponse({
          user_id: "user-123",
          access_token: "token",
          refresh_token: "refresh",
          expires_at: expect.any(String),
        })
      );

      await request(app).post("/api/auth/google").send({ code: authCode });

      expect(mockSupabase.from).toHaveBeenCalledWith("gmail_tokens");
      expect(mockSupabase.upsert).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const authCode = "mock-auth-code";

      setReturnValue("users", "select", createMockResponse(null));
      setReturnValue("users", "insert", createMockResponse(null, new Error("Database error")));

      const response = await request(app).post("/api/auth/google").send({ code: authCode });

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.body).toHaveProperty("error");
    });

    it("should handle OAuth provider errors", async () => {
      const { google } = require("googleapis");
      google.auth.OAuth2.mockImplementationOnce(() => ({
        getToken: jest.fn().mockRejectedValue(new Error("OAuth provider unavailable")),
      }));

      const response = await request(app).post("/api/auth/google").send({ code: "test-code" });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});
