import { google } from "googleapis";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabase } from "shared/database/supabase";
import { logger } from "../utils/logger";
import redis from "shared/cache/redis";

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
   * @param code - Authorization code from Google
   * @returns Access token, refresh token, and user info
   */
  async googleOAuth(code: string) {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Fetch user information from Google
      const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email) {
        throw new Error("Email not provided by Google");
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
          {
            onConflict: "google_id",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Database error:", error);
        throw new Error("Failed to create/update user");
      }

      // Store Gmail refresh token if present (for email integration)
      if (tokens.refresh_token) {
        await this.storeGmailToken(user.id, tokens.refresh_token);
      }

      // Generate application JWT tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Store session in Redis with 7-day expiry
      await redis.set(
        `session:${user.id}`,
        JSON.stringify({
          accessToken,
          refreshToken,
          createdAt: new Date().toISOString(),
        }),
        "EX",
        7 * 24 * 60 * 60 // 7 days
      );

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
    } catch (error: any) {
      console.error("OAuth error:", error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Generate JWT access token (15 minutes)
   */
  generateAccessToken(user: { id: string; email: string }): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: "access",
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" } as jwt.SignOptions
    );
  }

  /**
   * Generate JWT refresh token (7 days)
   */
  generateRefreshToken(user: { id: string; email: string }): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        type: "refresh",
      },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: "7d" } as jwt.SignOptions
    );
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Valid refresh token
   * @returns New access token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET!
      ) as any;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      // Check if session exists in Redis
      const session = await redis.get(`session:${decoded.userId}`);
      if (!session) {
        throw new Error("Session expired");
      }

      // Fetch user from database
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", decoded.userId)
        .single();

      if (error || !user) {
        throw new Error("User not found");
      }

      if (!user.is_active) {
        throw new Error("User account is inactive");
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user);

      // Update session in Redis
      const sessionData = JSON.parse(session);
      sessionData.accessToken = newAccessToken;
      sessionData.lastRefreshed = new Date().toISOString();

      await redis.set(
        `session:${user.id}`,
        JSON.stringify(sessionData),
        "EX",
        7 * 24 * 60 * 60
      );

      return { accessToken: newAccessToken };
    } catch (error: any) {
      console.error("Token refresh error:", error);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Logout user by removing session from Redis
   * @param userId - User ID to logout
   */
  async logout(userId: string): Promise<void> {
    try {
      await redis.del(`session:${userId}`);
    } catch (error) {
      console.error("Logout error:", error);
      throw new Error("Logout failed");
    }
  }

  /**
   * Get user information by user ID
   * @param userId - User ID
   * @returns User object
   */
  async getUserInfo(userId: string) {
    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("id, email, name, profile_picture, monthly_budget, created_at")
        .eq("id", userId)
        .single();

      if (error || !user) {
        throw new Error("User not found");
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profile_picture,
        monthlyBudget: user.monthly_budget,
        createdAt: user.created_at,
      };
    } catch (error: any) {
      console.error("Get user error:", error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
  }

  /**
   * Store encrypted Gmail refresh token for email integration
   * @param userId - User ID
   * @param refreshToken - Gmail refresh token from OAuth
   */
  private async storeGmailToken(
    userId: string,
    refreshToken: string
  ): Promise<void> {
    try {
      // Encrypt token using AES-256-GCM
      const algorithm = "aes-256-gcm";
      const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);

      let encrypted = cipher.update(refreshToken, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encryptedData
      const encryptedToken = `${iv.toString("hex")}:${authTag.toString(
        "hex"
      )}:${encrypted}`;

      // Store encrypted token in database
      await supabase.from("gmail_tokens").upsert({
        user_id: userId,
        refresh_token: encryptedToken,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        is_valid: true,
      });
    } catch (error) {
      console.error("Store Gmail token error:", error);
      // Don't throw - this is not critical for authentication
    }
  }

  /**
   * Verify if a token is valid
   * @param token - JWT token to verify
   * @param type - Token type ('access' or 'refresh')
   * @returns Decoded token payload
   */
  async verifyToken(token: string, type: "access" | "refresh" = "access") {
    try {
      const secret =
        type === "access"
          ? process.env.JWT_SECRET!
          : process.env.JWT_REFRESH_SECRET!;

      const decoded = jwt.verify(token, secret) as any;

      if (decoded.type !== type) {
        throw new Error("Invalid token type");
      }

      return decoded;
    } catch (error: any) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }
}
