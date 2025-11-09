import jwt from "jsonwebtoken";
import redis from "../../cache/redis";
import { logger } from "../../monitoring/logger";
import { sessionKey } from "../../cache/key-utils";

/**
 * Token Handler - Centralized JWT token management
 * Handles validation, refresh, and error codes for consistent authentication
 */

export interface TokenPayload {
  userId: string;
  email: string;
  type: "access" | "refresh";
  role?: string;
}

export enum TokenErrorCode {
  TOKEN_MISSING = "TOKEN_MISSING",
  TOKEN_INVALID = "TOKEN_INVALID",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
}

export class TokenError extends Error {
  constructor(
    public code: TokenErrorCode,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "TokenError";
  }
}

/**
 * Validates a JWT token and returns the decoded payload
 * @param token - JWT token string
 * @param type - Token type to validate ("access" or "refresh")
 * @returns Decoded token payload
 * @throws TokenError if validation fails
 */
export async function validateToken(
  token: string | undefined,
  type: "access" | "refresh" = "access"
): Promise<TokenPayload> {
  if (!token) {
    throw new TokenError(TokenErrorCode.TOKEN_MISSING, "No authentication token provided", 401);
  }

  try {
    const secret = type === "access" ? process.env.JWT_SECRET! : process.env.JWT_REFRESH_SECRET!;

    const decoded = jwt.verify(token, secret) as TokenPayload;

    // Verify token type matches expected type
    if (decoded.type !== type) {
      throw new TokenError(
        TokenErrorCode.TOKEN_INVALID,
        `Invalid token type. Expected ${type} token`,
        401
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenError(TokenErrorCode.TOKEN_EXPIRED, "Authentication token has expired", 401);
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new TokenError(TokenErrorCode.TOKEN_INVALID, "Invalid authentication token", 401);
    }

    // Unknown error
    logger.error("Token validation error:", error);
    throw new TokenError(TokenErrorCode.TOKEN_INVALID, "Token validation failed", 401);
  }
}

/**
 * Validates session exists in Redis
 * @param userId - User ID to check
 * @returns Session data if valid
 * @throws TokenError if session not found
 */
export async function validateSession(userId: string): Promise<any> {
  const session = await redis.get(sessionKey(userId));

  if (!session) {
    throw new TokenError(
      TokenErrorCode.SESSION_NOT_FOUND,
      "Session expired or not found. Please login again",
      401
    );
  }

  try {
    return JSON.parse(session);
  } catch (error) {
    logger.error("Session parse error:", error);
    throw new TokenError(TokenErrorCode.SESSION_NOT_FOUND, "Invalid session data", 401);
  }
}

/**
 * Generate a new JWT access token
 * @param user - User data
 * @returns JWT access token string
 */
export function generateAccessToken(user: { id: string; email: string; role?: string }): string {
  const expiresIn: string = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || "15m";

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role || "user",
      type: "access",
    },
    process.env.JWT_SECRET!,
    { expiresIn } as jwt.SignOptions
  );
}

/**
 * Generate a new JWT refresh token
 * @param user - User data
 * @returns JWT refresh token string
 */
export function generateRefreshToken(user: { id: string; email: string }): string {
  const expiresIn: string = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || "7d";

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn } as jwt.SignOptions
  );
}

/**
 * Store session in Redis
 * @param userId - User ID
 * @param accessToken - Access token
 * @param refreshToken - Refresh token
 * @param expirySeconds - Session expiry in seconds (default from env or 7 days)
 */
export async function storeSession(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expirySeconds?: number
): Promise<void> {
  const defaultExpiry = process.env.SESSION_EXPIRY_SECONDS
    ? parseInt(process.env.SESSION_EXPIRY_SECONDS, 10)
    : 7 * 24 * 60 * 60; // 7 days default
  const expiry = expirySeconds || defaultExpiry;
  await redis.set(
    sessionKey(userId),
    JSON.stringify({
      accessToken,
      refreshToken,
      createdAt: new Date().toISOString(),
    }),
    "EX",
    expiry
  );

  logger.info("Session stored", { userId });
}

/**
 * Update session with new access token
 * @param userId - User ID
 * @param accessToken - New access token
 */
export async function updateSessionToken(userId: string, accessToken: string): Promise<void> {
  const session = await validateSession(userId);
  const sessionExpiry = process.env.SESSION_EXPIRY_SECONDS
    ? parseInt(process.env.SESSION_EXPIRY_SECONDS, 10)
    : 7 * 24 * 60 * 60;

  await redis.set(
    sessionKey(userId),
    JSON.stringify({
      ...session,
      accessToken,
      lastRefreshed: new Date().toISOString(),
    }),
    "EX",
    sessionExpiry
  );

  logger.info("Session token updated", { userId });
}

/**
 * Delete session from Redis
 * @param userId - User ID
 */
export async function deleteSession(userId: string): Promise<void> {
  await redis.del(sessionKey(userId));
  logger.info("Session deleted", { userId });
}

/**
 * Check if a token is about to expire (within 2 minutes)
 * @param token - JWT token
 * @returns True if token expires soon
 */
export function isTokenExpiringSoon(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferSeconds = 2 * 60; // 2 minutes
    return decoded.exp - now <= bufferSeconds;
  } catch {
    return true;
  }
}

/**
 * Extract token from request headers or cookies
 * @param headers - Request headers
 * @param cookies - Request cookies
 * @returns Token string or undefined
 */
export function extractToken(
  headers: Record<string, string | string[] | undefined>,
  cookies: Record<string, string>
): string | undefined {
  // Try cookie first (httpOnly)
  if (cookies?.accessToken) {
    return cookies.accessToken;
  }

  // Fall back to Authorization header
  const authHeader = headers.authorization || headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "");
  }

  return undefined;
}
