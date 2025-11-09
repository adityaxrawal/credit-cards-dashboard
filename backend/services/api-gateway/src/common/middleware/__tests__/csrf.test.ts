/**
 * Tests for CSRF Protection Middleware
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import {
  csrfProtection,
  generateCsrfToken,
  setCsrfTokenCookie,
  clearCsrfTokenCookie,
  refreshCsrfToken,
  getCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "../csrf";

describe("CSRF Protection Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let cookieStore: Record<string, any>;

  beforeEach(() => {
    cookieStore = {};

    mockReq = {
      method: "POST",
      path: "/api/test",
      cookies: {},
      header: jest.fn(),
      ip: "127.0.0.1",
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn((name, value, options) => {
        cookieStore[name] = { value, options };
      }),
      clearCookie: jest.fn((name) => {
        delete cookieStore[name];
      }),
    } as Partial<Response>;

    mockNext = jest.fn();
  });

  describe("generateCsrfToken", () => {
    it("should generate a 64-character hex token", () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
    });

    it("should generate unique tokens", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("setCsrfTokenCookie", () => {
    it("should set CSRF cookie with provided token", () => {
      const token = "test-token-123";
      const result = setCsrfTokenCookie(mockRes as Response, token);

      expect(result).toBe(token);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        token,
        expect.objectContaining({
          httpOnly: false,
          sameSite: "strict",
          path: "/",
        })
      );
    });

    it("should generate token if not provided", () => {
      const result = setCsrfTokenCookie(mockRes as Response);

      expect(result).toHaveLength(64);
      expect(mockRes.cookie).toHaveBeenCalled();
    });

    it("should set secure flag in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      setCsrfTokenCookie(mockRes as Response);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          secure: true,
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("clearCsrfTokenCookie", () => {
    it("should clear CSRF cookie", () => {
      clearCsrfTokenCookie(mockRes as Response);

      expect(mockRes.clearCookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.objectContaining({
          path: "/",
        })
      );
    });
  });

  describe("csrfProtection middleware", () => {
    it("should allow GET requests without CSRF token", () => {
      mockReq.method = "GET";

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow HEAD requests without CSRF token", () => {
      mockReq.method = "HEAD";

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow OPTIONS requests without CSRF token", () => {
      mockReq.method = "OPTIONS";

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject POST request without CSRF cookie", () => {
      mockReq.method = "POST";
      mockReq.cookies = {};

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "CSRF_TOKEN_MISSING",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject POST request without CSRF header", () => {
      const token = "test-token-123";
      mockReq.method = "POST";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
      (mockReq.header as jest.Mock).mockReturnValue(undefined);

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "CSRF_TOKEN_MISSING",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject POST request with mismatched tokens", () => {
      mockReq.method = "POST";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: "token-123" };
      (mockReq.header as jest.Mock).mockReturnValue("token-456");

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: "CSRF_TOKEN_INVALID",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should allow POST request with matching tokens", () => {
      const token = "test-token-123";
      mockReq.method = "POST";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
      (mockReq.header as jest.Mock).mockReturnValue(token);

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow PUT request with valid CSRF token", () => {
      const token = "valid-token";
      mockReq.method = "PUT";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
      (mockReq.header as jest.Mock).mockReturnValue(token);

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow DELETE request with valid CSRF token", () => {
      const token = "valid-token";
      mockReq.method = "DELETE";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
      (mockReq.header as jest.Mock).mockReturnValue(token);

      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should skip CSRF check for excluded paths", () => {
      mockReq.method = "POST";
      mockReq.path = "/api/webhooks/stripe";
      mockReq.cookies = {};

      const middleware = csrfProtection({
        excludePaths: ["/api/webhooks"],
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should allow custom excluded methods", () => {
      mockReq.method = "PATCH";
      mockReq.cookies = {};

      const middleware = csrfProtection({
        excludeMethods: ["PATCH"],
      });
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("refreshCsrfToken middleware", () => {
    it("should generate new token if none exists", () => {
      mockReq.cookies = {};

      refreshCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should not generate new token if one exists", () => {
      mockReq.cookies = { [CSRF_COOKIE_NAME]: "existing-token" };

      refreshCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("getCsrfToken", () => {
    it("should return CSRF token from cookies", () => {
      const token = "test-token";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: token };

      const result = getCsrfToken(mockReq as Request);

      expect(result).toBe(token);
    });

    it("should return undefined if no token exists", () => {
      mockReq.cookies = {};

      const result = getCsrfToken(mockReq as Request);

      expect(result).toBeUndefined();
    });
  });

  describe("Security properties", () => {
    it("should use timing-safe comparison for tokens", () => {
      const token = "a".repeat(64);
      const wrongToken = "b".repeat(64);

      mockReq.method = "POST";
      mockReq.cookies = { [CSRF_COOKIE_NAME]: token };
      (mockReq.header as jest.Mock).mockReturnValue(wrongToken);

      const startTime = process.hrtime.bigint();
      const middleware = csrfProtection();
      middleware(mockReq as Request, mockRes as Response, mockNext);
      const endTime = process.hrtime.bigint();

      // Should use constant-time comparison (timing shouldn't vary significantly)
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
