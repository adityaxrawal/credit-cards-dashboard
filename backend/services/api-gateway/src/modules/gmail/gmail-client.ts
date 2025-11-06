import dotenv from "dotenv";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { gmail_v1 } from "googleapis";
import { supabase } from "shared/database/supabase";
import { createTokenManager, TokenManager } from "./token-manager";
import { logger } from "../../utils/logger";

// Load environment variables
dotenv.config();

/**
 * Gmail Client - Handles all Gmail API operations
 * Manages OAuth tokens, email fetching, and watch API setup
 */
export class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: gmail_v1.Gmail | null = null;
  private supabase;
  private tokenManager: TokenManager;

  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Use shared Supabase client
    this.supabase = supabase;

    // Initialize token manager
    this.tokenManager = createTokenManager(this.oauth2Client);
  }

  /**
   * Generate OAuth authorization URL
   * Scopes: gmail.readonly for reading emails
   */
  getAuthUrl(): string {
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline", // Get refresh token
      scope: scopes,
      prompt: "consent", // Force consent screen to always get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code from OAuth callback
   * @returns Access token, refresh token, and expiry
   */
  async exchangeCodeForTokens(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiryDate: tokens.expiry_date!,
      };
    } catch (error) {
      logger.error("Error exchanging code for tokens", {  error  });
      throw new Error("Failed to exchange authorization code for tokens");
    }
  }

  /**
   * Initialize Gmail API client for a specific user
   * @param userId - User ID from database
   * @returns Initialized Gmail API client
   */
  async initializeForUser(userId: string): Promise<gmail_v1.Gmail> {
    try {
      // Get valid access token (refreshes if needed)
      const accessToken = await this.tokenManager.getValidAccessToken(userId);

      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: accessToken,
      });

      // Initialize Gmail API
      this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

      logger.info("Gmail API initialized for user", {  userId  });

      return this.gmail;
    } catch (error) {
      logger.error("Error initializing Gmail for user", {  error, userId  });
      throw error;
    }
  }

  /**
   * Update user's Gmail tokens in database
   * @param userId - User ID
   * @param tokens - Token data to update
   */
  private async updateUserTokens(
    userId: string,
    tokens: {
      refreshToken?: string;
      accessToken: string;
      expiryDate: number;
    }
  ): Promise<void> {
    try {
      const updateData: any = {
        gmail_access_token: tokens.accessToken,
        gmail_token_expiry: new Date(tokens.expiryDate).toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (tokens.refreshToken) {
        updateData.gmail_refresh_token = tokens.refreshToken;
      }

      const { error } = await this.supabase
        .from("users")
        .update(updateData)
        .eq("id", userId);

      if (error) {
        console.error("Error updating user tokens:", error);
        throw error;
      }
    } catch (error) {
      console.error("Failed to update user tokens in database:", error);
      throw error;
    }
  }

  /**
   * Store Gmail tokens for a user after OAuth
   * @param userId - User ID
   * @param tokens - OAuth tokens
   */
  async storeUserTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiryDate: number;
    }
  ): Promise<void> {
    await this.tokenManager.storeTokens(userId, tokens);
  }

  /**
   * Get user's Gmail profile
   * @param userId - User ID
   * @returns Gmail email address
   */
  async getUserProfile(userId: string): Promise<string> {
    const gmail = await this.initializeForUser(userId);

    try {
      const response = await gmail.users.getProfile({ userId: "me" });
      return response.data.emailAddress!;
    } catch (error) {
      console.error("Error fetching Gmail profile:", error);
      throw new Error("Failed to fetch Gmail profile");
    }
  }

  /**
   * List messages with filters
   * @param userId - User ID
   * @param options - Filter options
   * @returns Array of message IDs and thread IDs
   */
  async listMessages(
    userId: string,
    options: {
      query?: string; // Gmail search query
      maxResults?: number; // Max 500
      pageToken?: string; // For pagination
      labelIds?: string[]; // Filter by labels
      after?: Date; // Messages after this date
      before?: Date; // Messages before this date
    } = {}
  ): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    const gmail = await this.initializeForUser(userId);

    try {
      // Build query string
      let query = options.query || "";

      // Add date filters to query
      if (options.after) {
        const afterDate = Math.floor(options.after.getTime() / 1000);
        query += ` after:${afterDate}`;
      }
      if (options.before) {
        const beforeDate = Math.floor(options.before.getTime() / 1000);
        query += ` before:${beforeDate}`;
      }

      const response = await gmail.users.messages.list({
        userId: "me",
        q: query.trim() || undefined,
        maxResults: Math.min(options.maxResults || 100, 500),
        pageToken: options.pageToken,
        labelIds: options.labelIds,
      });

      return {
        messages: (response.data.messages || []).map((m) => ({
          id: m.id!,
          threadId: m.threadId!,
        })),
        nextPageToken: response.data.nextPageToken || undefined,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    } catch (error) {
      console.error("Error listing messages:", error);
      throw new Error("Failed to list Gmail messages");
    }
  }

  /**
   * Get full message details
   * @param userId - User ID
   * @param messageId - Gmail message ID
   * @returns Full message object with headers, body, etc.
   */
  async getMessage(
    userId: string,
    messageId: string
  ): Promise<gmail_v1.Schema$Message> {
    const gmail = await this.initializeForUser(userId);

    try {
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full", // Get full message including body
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      throw new Error("Failed to fetch Gmail message");
    }
  }

  /**
   * Extract email body from message
   * @param message - Gmail message object
   * @returns Plain text and HTML body
   */
  extractMessageBody(message: gmail_v1.Schema$Message): {
    text: string;
    html: string;
  } {
    let text = "";
    let html = "";

    const getBody = (part: gmail_v1.Schema$MessagePart): void => {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html += Buffer.from(part.body.data, "base64").toString("utf-8");
      }

      // Recursively process parts
      if (part.parts) {
        part.parts.forEach(getBody);
      }
    };

    if (message.payload) {
      getBody(message.payload);
    }

    return { text, html };
  }

  /**
   * Extract headers from message
   * @param message - Gmail message object
   * @returns Object with common headers
   */
  extractHeaders(message: gmail_v1.Schema$Message): {
    from: string;
    to: string;
    subject: string;
    date: string;
  } {
    const headers = message.payload?.headers || [];

    const getHeader = (name: string): string => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || "";
    };

    return {
      from: getHeader("from"),
      to: getHeader("to"),
      subject: getHeader("subject"),
      date: getHeader("date"),
    };
  }

  /**
   * Check if Gmail is connected for user
   * @param userId - User ID
   * @returns True if connected
   */
  async isConnected(userId: string): Promise<boolean> {
    return this.tokenManager.hasValidTokens(userId);
  }

  /**
   * Disconnect Gmail for user
   * Revokes tokens and removes from database
   * @param userId - User ID
   */
  async disconnect(userId: string): Promise<void> {
    try {
      await this.tokenManager.revokeTokens(userId);
      logger.info("Gmail disconnected successfully", {  userId  });
    } catch (error) {
      logger.error("Error disconnecting Gmail", {  error, userId  });
      throw new Error("Failed to disconnect Gmail");
    }
  }
}

// Export singleton instance
export const gmailClient = new GmailClient();
