import { google } from "googleapis";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";
import {
  generateAccessToken,
  generateRefreshToken,
  storeSession,
  validateToken,
  validateSession,
  updateSessionToken,
  deleteSession,
} from "shared/lib/auth/tokenHandler";
import { IAuthResponse, IUser, ITokenRefreshResponse } from "./interfaces/auth.interface";
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
      // Debug: Log the redirect URI being used
      logger.info("OAuth Config", {
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        clientId: process.env.GOOGLE_CLIENT_ID?.slice(0, 20) + "...",
        codeLength: code.length,
      });

      // Exchange authorization code for tokens
      // MUST pass the same redirect_uri that was used in the authorization request
      let tokens;
      try {
        const response = await this.oauth2Client.getToken({
          code,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        });
        tokens = response.tokens;
        this.oauth2Client.setCredentials(tokens);
      } catch (tokenError: unknown) {
        // Enhanced error logging for OAuth token exchange
        const error = tokenError as Error & { code?: string };
        logger.error("Failed to exchange authorization code for tokens", error, {
          errorCode: error.code,
          errorMessage: error.message,
          redirectUri: process.env.GOOGLE_REDIRECT_URI,
        });

        // Provide user-friendly error messages
        if (error.message?.includes("invalid_grant")) {
          throw new Error(
            "Authorization code is expired or invalid. Please try logging in again. " +
              "OAuth codes expire after 10 minutes."
          );
        } else if (error.message?.includes("redirect_uri_mismatch")) {
          throw new Error(
            `Redirect URI mismatch. The redirect URI used in the authorization request ` +
              `must match exactly with '${process.env.GOOGLE_REDIRECT_URI}'. ` +
              `Please check your Google Cloud Console OAuth configuration.`
          );
        } else {
          throw new Error(
            `Google OAuth failed: ${error.message || "Unknown error"}. ` +
              `Please try logging in again.`
          );
        }
      }

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
            updated_at: new Date().toISOString(),
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
        logger.info("Gmail refresh token received, storing...", { userId: user.id });
        await this.storeGmailToken(user.id, tokens.refresh_token);
      } else {
        logger.warn("No Gmail refresh token received from Google OAuth", {
          userId: user.id,
          hint: "User may have already authorized. Try revoking access at https://myaccount.google.com/permissions and re-authorizing.",
        });
      }

      // Generate application JWT tokens using centralized token handler
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Store session in Redis using centralized handler
      await storeSession(user.id, accessToken, refreshToken);

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
   * Refresh access token using refresh token
   * Uses centralized token handler for validation and generation
   */
  async refreshAccessToken(refreshToken: string): Promise<ITokenRefreshResponse> {
    try {
      // Validate refresh token using centralized handler
      const decoded = await validateToken(refreshToken, "refresh");

      // Validate session exists
      await validateSession(decoded.userId);

      // Fetch user
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", decoded.userId)
        .single();

      if (error || !user || !user.is_active) {
        throw new Error(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
      }

      // Generate new access token using centralized handler
      const newAccessToken = generateAccessToken(user);

      // Update session with new token
      await updateSessionToken(user.id, newAccessToken);

      return {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profilePicture: user.profile_picture,
          monthlyBudget: user.monthly_budget,
        },
      };
    } catch (error) {
      logger.error("Token refresh failed", error as Error);
      throw error;
    }
  }

  /**
   * Logout user - Uses centralized session handler
   */
  async logout(userId: string): Promise<void> {
    try {
      await deleteSession(userId);
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
   * Store encrypted Gmail refresh token in users table
   * This is called during OAuth login when Gmail scopes are granted
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

      // Store in users table (used by Gmail client token-manager)
      const { error } = await supabase
        .from("users")
        .update({
          gmail_refresh_token: encryptedToken,
          gmail_access_token: null, // Will be generated on first use
          gmail_token_expiry: null, // Will be set on first use
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        logger.error("Failed to store Gmail token in users table", error);
      } else {
        logger.info("Gmail refresh token stored successfully", { userId });
      }

      // Also store in gmail_tokens table for backward compatibility
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
   * Verify token - Uses centralized token handler
   */
  async verifyToken(token: string, type: "access" | "refresh" = "access"): Promise<jwt.JwtPayload> {
    try {
      return (await validateToken(token, type)) as jwt.JwtPayload;
    } catch {
      throw new Error(ERROR_MESSAGES.AUTH.TOKEN_INVALID);
    }
  }
}

export const authService = new AuthService();
