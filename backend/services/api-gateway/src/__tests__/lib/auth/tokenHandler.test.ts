import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  validateToken,
  generateAccessToken,
  generateRefreshToken,
  extractToken,
  isTokenExpiringSoon,
  TokenError,
  TokenErrorCode,
} from "shared/lib/auth/tokenHandler";

describe("Token Handler", () => {
  const TEST_JWT_SECRET = "test-secret-key-for-access-tokens";
  const TEST_JWT_REFRESH_SECRET = "test-secret-key-for-refresh-tokens";
  const testUser = {
    id: "user-123",
    email: "test@example.com",
    role: "user",
  };

  // Set up environment variables for tests
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = TEST_JWT_REFRESH_SECRET;
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  describe("generateAccessToken", () => {
    it("should generate a valid access token", () => {
      const token = generateAccessToken(testUser);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.type).toBe("access");
    });

    it("should include role in token", () => {
      const token = generateAccessToken(testUser);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.role).toBe("user");
    });

    it("should set expiry to 15 minutes", () => {
      const token = generateAccessToken(testUser);
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;

      const now = Math.floor(Date.now() / 1000);
      const expectedExpiry = now + 15 * 60; // 15 minutes

      // Allow 5 second tolerance
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5);
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid refresh token", () => {
      const token = generateRefreshToken(testUser);
      expect(token).toBeTruthy();

      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET) as any;
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.type).toBe("refresh");
    });

    it("should set expiry to 7 days", () => {
      const token = generateRefreshToken(testUser);
      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET) as any;

      const now = Math.floor(Date.now() / 1000);
      const expectedExpiry = now + 7 * 24 * 60 * 60; // 7 days

      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiry + 5);
    });
  });

  describe("validateToken", () => {
    it("should validate a valid access token", async () => {
      const token = generateAccessToken(testUser);
      const payload = await validateToken(token, "access");

      expect(payload.userId).toBe(testUser.id);
      expect(payload.email).toBe(testUser.email);
      expect(payload.type).toBe("access");
    });

    it("should validate a valid refresh token", async () => {
      const token = generateRefreshToken(testUser);
      const payload = await validateToken(token, "refresh");

      expect(payload.userId).toBe(testUser.id);
      expect(payload.type).toBe("refresh");
    });

    it("should throw TOKEN_MISSING for undefined token", async () => {
      await expect(validateToken(undefined, "access")).rejects.toThrow(TokenError);

      try {
        await validateToken(undefined, "access");
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        expect((error as TokenError).code).toBe(TokenErrorCode.TOKEN_MISSING);
      }
    });

    it("should throw TOKEN_INVALID for malformed token", async () => {
      await expect(validateToken("invalid.token.here", "access")).rejects.toThrow(TokenError);

      try {
        await validateToken("invalid.token.here", "access");
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        expect((error as TokenError).code).toBe(TokenErrorCode.TOKEN_INVALID);
      }
    });

    it("should throw TOKEN_EXPIRED for expired token", async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id, email: testUser.email, type: "access" },
        TEST_JWT_SECRET,
        { expiresIn: "-1h" } // Already expired
      );

      await expect(validateToken(expiredToken, "access")).rejects.toThrow(TokenError);

      try {
        await validateToken(expiredToken, "access");
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        expect((error as TokenError).code).toBe(TokenErrorCode.TOKEN_EXPIRED);
      }
    });

    it("should throw TOKEN_INVALID for wrong token type", async () => {
      const refreshToken = generateRefreshToken(testUser);

      await expect(validateToken(refreshToken, "access")).rejects.toThrow(TokenError);

      try {
        await validateToken(refreshToken, "access");
      } catch (error) {
        expect(error).toBeInstanceOf(TokenError);
        expect((error as TokenError).code).toBe(TokenErrorCode.TOKEN_INVALID);
      }
    });

    it("should throw TOKEN_INVALID for token signed with wrong secret", async () => {
      const wrongToken = jwt.sign(
        { userId: testUser.id, email: testUser.email, type: "access" },
        "wrong-secret",
        { expiresIn: "15m" }
      );

      await expect(validateToken(wrongToken, "access")).rejects.toThrow(TokenError);
    });
  });

  describe("extractToken", () => {
    it("should extract token from cookie", () => {
      const token = "test-token-from-cookie";
      const cookies = { accessToken: token };
      const headers = {};

      const extracted = extractToken(headers, cookies);
      expect(extracted).toBe(token);
    });

    it("should extract token from Authorization header", () => {
      const token = "test-token-from-header";
      const cookies = {};
      const headers = { authorization: `Bearer ${token}` };

      const extracted = extractToken(headers, cookies);
      expect(extracted).toBe(token);
    });

    it("should prefer cookie over header", () => {
      const cookieToken = "cookie-token";
      const headerToken = "header-token";
      const cookies = { accessToken: cookieToken };
      const headers = { authorization: `Bearer ${headerToken}` };

      const extracted = extractToken(headers, cookies);
      expect(extracted).toBe(cookieToken);
    });

    it("should return undefined when no token present", () => {
      const cookies = {};
      const headers = {};

      const extracted = extractToken(headers, cookies);
      expect(extracted).toBeUndefined();
    });

    it("should handle Authorization header with capital A", () => {
      const token = "test-token";
      const cookies = {};
      const headers = { Authorization: `Bearer ${token}` };

      const extracted = extractToken(headers, cookies);
      expect(extracted).toBe(token);
    });

    it("should return undefined for malformed Authorization header", () => {
      const cookies = {};
      const headers = { authorization: "NotBearer token" };

      const extracted = extractToken(headers, cookies);
      expect(extracted).toBeUndefined();
    });
  });

  describe("isTokenExpiringSoon", () => {
    it("should return false for token expiring in 10 minutes", () => {
      const token = jwt.sign({ userId: testUser.id, type: "access" }, TEST_JWT_SECRET, {
        expiresIn: "10m",
      });

      expect(isTokenExpiringSoon(token)).toBe(false);
    });

    it("should return true for token expiring in 1 minute", () => {
      const token = jwt.sign({ userId: testUser.id, type: "access" }, TEST_JWT_SECRET, {
        expiresIn: "1m",
      });

      expect(isTokenExpiringSoon(token)).toBe(true);
    });

    it("should return true for expired token", () => {
      const token = jwt.sign({ userId: testUser.id, type: "access" }, TEST_JWT_SECRET, {
        expiresIn: "-1h",
      });

      expect(isTokenExpiringSoon(token)).toBe(true);
    });

    it("should return true for invalid token", () => {
      expect(isTokenExpiringSoon("invalid-token")).toBe(true);
    });

    it("should return true for token without expiry", () => {
      const token = jwt.sign(
        { userId: testUser.id, type: "access" },
        TEST_JWT_SECRET
        // No expiresIn option
      );

      expect(isTokenExpiringSoon(token)).toBe(true);
    });
  });
});
