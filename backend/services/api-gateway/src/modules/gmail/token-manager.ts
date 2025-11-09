import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";
import { AppError } from "shared/errors/AppError";

/**
 * Token Manager - Securely manages Gmail OAuth tokens
 * Handles encryption, storage, refresh, and expiry checks
 */
export class TokenManager {
  private supabase;
  private oauth2Client: OAuth2Client;
  private readonly ALGORITHM = "aes-256-gcm";
  private readonly ENCRYPTION_KEY: Buffer;

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;

    // Use shared Supabase client
    this.supabase = supabase;

    // Encryption key must be 32 bytes for aes-256
    const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!key) {
      throw AppError.internal("ENCRYPTION_KEY or JWT_SECRET must be set");
    }
    // Create 32-byte key from env variable
    this.ENCRYPTION_KEY = Buffer.from(key.padEnd(32, "0").slice(0, 32));
  }

  /**
   * Encrypt sensitive token data
   * @param text - Plain text to encrypt
   * @returns Encrypted string with IV and auth tag
   */
  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypt sensitive token data
   * @param encryptedText - Encrypted string with IV and auth tag
   * @returns Decrypted plain text
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw AppError.validation("Invalid encrypted token format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = createDecipheriv(this.ALGORITHM, this.ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Store user's Gmail tokens securely
   * @param userId - User ID
   * @param tokens - OAuth tokens from Google
   */
  async storeTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiryDate: number;
    }
  ): Promise<void> {
    try {
      // Encrypt refresh token
      const encryptedRefreshToken = this.encrypt(tokens.refreshToken);

      // Store in database
      const { error } = await this.supabase
        .from("users")
        .update({
          gmail_refresh_token: encryptedRefreshToken,
          gmail_access_token: tokens.accessToken,
          gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        logger.error("Failed to store Gmail tokens", error as Error);
        throw AppError.database("Failed to store tokens", { error });
      }

      logger.info("Gmail tokens stored successfully", { userId });
    } catch (error) {
      logger.error("Error storing tokens", error as Error);
      throw error;
    }
  }

  /**
   * Retrieve and decrypt user's tokens
   * @param userId - User ID
   * @returns Decrypted tokens or null if not found
   */
  async getTokens(userId: string): Promise<{
    accessToken: string | null;
    refreshToken: string;
    expiryDate: number;
  } | null> {
    try {
      const { data: user, error } = await this.supabase
        .from("users")
        .select("gmail_refresh_token, gmail_access_token, gmail_token_expiry")
        .eq("id", userId)
        .single();

      if (error || !user || !user.gmail_refresh_token) {
        return null;
      }

      // Decrypt refresh token
      const refreshToken = this.decrypt(user.gmail_refresh_token);

      return {
        accessToken: user.gmail_access_token || null,
        refreshToken,
        expiryDate: user.gmail_token_expiry ? new Date(user.gmail_token_expiry).getTime() : 0,
      };
    } catch (error) {
      logger.error("Error retrieving tokens", error as Error);
      throw error;
    }
  }

  /**
   * Check if token is expired or about to expire
   * @param expiryDate - Token expiry timestamp
   * @returns True if token needs refresh
   */
  isTokenExpired(expiryDate: number): boolean {
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
    return now >= expiryDate - bufferMs;
  }

  /**
   * Refresh access token using refresh token
   * @param userId - User ID
   * @returns New access token and expiry
   */
  async refreshAccessToken(userId: string): Promise<{
    accessToken: string;
    expiryDate: number;
  }> {
    try {
      const tokens = await this.getTokens(userId);
      if (!tokens) {
        throw AppError.externalService("Gmail", "No tokens found for user");
      }

      // Set refresh token
      this.oauth2Client.setCredentials({
        refresh_token: tokens.refreshToken,
      });

      // Refresh token
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token || !credentials.expiry_date) {
        throw AppError.internal("Failed to refresh token - missing credentials");
      }

      // Update database with new access token
      await this.supabase
        .from("users")
        .update({
          gmail_access_token: credentials.access_token,
          gmail_token_expiry: new Date(credentials.expiry_date).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      logger.info("Access token refreshed successfully", { userId });

      return {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date,
      };
    } catch (error) {
      logger.error("Failed to refresh access token", error as Error);
      throw error;
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * @param userId - User ID
   * @returns Valid access token
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.getTokens(userId);
    if (!tokens) {
      throw AppError.externalService("Gmail", "No tokens found for user");
    }

    // Check if token needs refresh
    if (this.isTokenExpired(tokens.expiryDate) || !tokens.accessToken) {
      const refreshed = await this.refreshAccessToken(userId);
      return refreshed.accessToken;
    }

    return tokens.accessToken;
  }

  /**
   * Revoke user's Gmail tokens
   * @param userId - User ID
   */
  async revokeTokens(userId: string): Promise<void> {
    try {
      const tokens = await this.getTokens(userId);
      if (!tokens) {
        return;
      }

      // Revoke token with Google
      try {
        await this.oauth2Client.revokeToken(tokens.refreshToken);
      } catch (error) {
        // Log but don't fail - token might already be invalid
        logger.warn("Failed to revoke token with Google", { error, userId });
      }

      // Clear from database
      await this.supabase
        .from("users")
        .update({
          gmail_refresh_token: null,
          gmail_access_token: null,
          gmail_token_expiry: null,
          gmail_watch_expiration: null,
          gmail_history_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      logger.info("Gmail tokens revoked successfully", { userId });
    } catch (error) {
      logger.error("Error revoking tokens", error as Error);
      throw error;
    }
  }

  /**
   * Check if user has valid tokens
   * @param userId - User ID
   * @returns True if user has tokens
   */
  async hasValidTokens(userId: string): Promise<boolean> {
    try {
      const tokens = await this.getTokens(userId);
      return tokens !== null;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const createTokenManager = (oauth2Client: OAuth2Client) => new TokenManager(oauth2Client);
