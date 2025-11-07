import { google } from "googleapis";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";
import redis from "shared/cache/redis";
import { IAuthResponse, IUser } from "./interfaces/auth.interface";
import { ERROR_MESSAGES } from "../../constants";

/**
 * AuthService handles all authentication-related operations
 * Including Google OAuth, JWT token generation, session management
 */
export class AuthService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Handle Google OAuth authentication
   */
  async googleOAuth(code: string): Promise<IAuthResponse> {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Fetch user information from Google
      const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email) {
        throw new Error(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS);
      }

      // Upsert user in database
      const { data: user, error } = await supabase
        .from("users")
        .upsert(
          {
            google_id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name || userInfo.email,
            profile_picture: userInfo.picture,
            is_active: true,
            last_login: new Date().toISOString(),
          },
          { onConflict: "google_id" }
        )
        .select()
        .single();

      if (error) {
        logger.error("Database error during OAuth", error);
        throw new Error(ERROR_MESSAGES.GENERIC.DATABASE_ERROR);
      }

      // Store Gmail refresh token if present
      if (tokens.refresh_token) {
        await this.storeGmailToken(user.id, tokens.refresh_token);
      }

      // Generate application JWT tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store session in Redis
      await redis.set(
        `session:${user.id}`,
        JSON.stringify({
          accessToken,
          refreshToken,
          createdAt: new Date().toISOString(),
        }),
        "EX",
        7 * 24 * 60 * 60
      );

      logger.info("User authenticated successfully", { userId: user.id });

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profilePicture: user.profile_picture,
          monthlyBudget: user.monthly_budget,
        },
      };
    } catch (error) {
      logger.error("OAuth authentication failed", error as Error);
      throw error;
    }
  }

  /**
   * Generate JWT access token
   */
  private generateAccessToken(user: { id: string; email: string }): string {
    return jwt.sign(
      { userId: user.id, email: user.email, type: "access" },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" }
    );
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(user: { id: string; email: string }): string {
    return jwt.sign(
      { userId: user.id, email: user.email, type: "refresh" },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: "7d" }
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload;

      if (decoded.type !== "refresh") {
        throw new Error(ERROR_MESSAGES.AUTH.TOKEN_INVALID);
      }

      // Check session
      const session = await redis.get(`session:${decoded.userId}`);
      if (!session) {
        throw new Error(ERROR_MESSAGES.AUTH.TOKEN_EXPIRED);
      }

      // Fetch user
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", decoded.userId)
        .single();

      if (error || !user || !user.is_active) {
        throw new Error(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user);

      // Update session
      const sessionData = JSON.parse(session);
      sessionData.accessToken = newAccessToken;
      sessionData.lastRefreshed = new Date().toISOString();

      await redis.set(`session:${user.id}`, JSON.stringify(sessionData), "EX", 7 * 24 * 60 * 60);

      return { accessToken: newAccessToken };
    } catch (error) {
      logger.error("Token refresh failed", error as Error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<void> {
    try {
      await redis.del(`session:${userId}`);
      logger.info("User logged out", { userId });
    } catch (error) {
      logger.error("Logout failed", error as Error);
      throw new Error(ERROR_MESSAGES.GENERIC.INTERNAL_ERROR);
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(userId: string): Promise<IUser> {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("id, email, name, profile_picture, monthly_budget, created_at")
        .eq("id", userId)
        .single();

      if (error || !user) {
        throw new Error(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profile_picture,
        monthlyBudget: user.monthly_budget,
        createdAt: user.created_at,
      };
    } catch (error) {
      logger.error("Failed to fetch user", error as Error);
      throw error;
    }
  }

  /**
   * Store encrypted Gmail refresh token
   */
  private async storeGmailToken(userId: string, refreshToken: string): Promise<void> {
    try {
      const algorithm = "aes-256-gcm";
      const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(refreshToken, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      const encryptedToken = `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;

      await supabase.from("gmail_tokens").upsert({
        user_id: userId,
        refresh_token: encryptedToken,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        is_valid: true,
      });
    } catch (error) {
      logger.error("Failed to store Gmail token", error as Error);
      // Non-critical - don't throw
    }
  }

  /**
   * Verify token
   */
  async verifyToken(token: string, type: "access" | "refresh" = "access"): Promise<jwt.JwtPayload> {
    try {
      const secret = type === "access" ? process.env.JWT_SECRET! : process.env.JWT_REFRESH_SECRET!;

      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

      if (decoded.type !== type) {
        throw new Error(ERROR_MESSAGES.AUTH.TOKEN_INVALID);
      }

      return decoded;
    } catch (error) {
      throw new Error(ERROR_MESSAGES.AUTH.TOKEN_INVALID);
    }
  }
}

export const authService = new AuthService();
