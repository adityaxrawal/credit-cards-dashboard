import { google, gmail_v1, Auth } from 'googleapis';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/src/backend/lib/utils/encryption';

/**
 * Rate limiter class for Gmail API to prevent exceeding quota limits
 * @class GmailRateLimiter
 */
class GmailRateLimiter {
  private requests: number[] = [];
  private readonly maxRequestsPerMinute = 250;

  /**
   * Check if we can make a request without exceeding rate limits
   * @returns {Promise<void>} Promise that resolves when it's safe to make a request
   * @example
   * ```typescript
   * const limiter = new GmailRateLimiter();
   * await limiter.checkLimit(); // Will wait if necessary
   * // Now safe to make Gmail API request
   * ```
   */
  async checkLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter(timestamp => timestamp > oneMinuteAgo);

    // If we're at the limit, wait until we can make another request
    if (this.requests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = oldestRequest + 60 * 1000 - now + 100; // Add 100ms buffer
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.checkLimit(); // Recursively check again
      }
    }

    // Record this request
    this.requests.push(now);
  }
}

/**
 * Gmail OAuth token data structure
 * @interface GmailTokenData
 */
export interface GmailTokenData {
  /** OAuth access token for Gmail API */
  access_token: string;
  /** OAuth refresh token for renewing access */
  refresh_token: string;
  /** OAuth scope permissions granted */
  scope: string;
  /** Type of token (usually 'Bearer') */
  token_type: string;
  /** Unix timestamp when token expires */
  expiry_date: number;
}

/**
 * Gmail watch configuration for push notifications
 * @interface GmailWatchConfig
 */
export interface GmailWatchConfig {
  /** Gmail history ID to start watching from */
  historyId: string;
  /** Unix timestamp when watch expires */
  expiration: number;
}

/**
 * Service class for interacting with Gmail API
 * Handles authentication, rate limiting, and email operations
 * @class GmailService
 */
export class GmailService {
  private userId: string;
  private oauth2Client: Auth.OAuth2Client;
  private rateLimiter: GmailRateLimiter;

  /**
   * Create a new Gmail service instance
   * @param {string} userId - The ID of the user to authenticate for
   * @example
   * ```typescript
   * const gmailService = new GmailService('user123');
   * const client = await gmailService.getClient();
   * ```
   */
  constructor(userId: string) {
    this.userId = userId;
    this.rateLimiter = new GmailRateLimiter();
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get Gmail client with authenticated credentials
   * @returns {Promise<gmail_v1.Gmail>} Authenticated Gmail API client
   * @throws {Error} When tokens are not found or authentication fails
   * @example
   * ```typescript
   * const service = new GmailService('user123');
   * const gmail = await service.getClient();
   * const messages = await gmail.users.messages.list({ userId: 'me' });
   * ```
   */
  async getClient(): Promise<gmail_v1.Gmail> {
    try {
      await this.rateLimiter.checkLimit();
      
      const supabase = await createClient();
      
      // Fetch encrypted tokens from gmail_tokens table
      const { data: tokenData, error } = await supabase
        .from('gmail_tokens')
        .select('encrypted_access_token, encrypted_refresh_token, scope, token_type, expiry_date')
        .eq('user_id', this.userId)
        .single();

      if (error || !tokenData) {
        throw new Error(`No Gmail tokens found for user ${this.userId}: ${error?.message || 'Token not found'}`);
      }

      // Decrypt tokens using encryption utils
      const accessToken = decrypt(tokenData.encrypted_access_token);
      const refreshToken = decrypt(tokenData.encrypted_refresh_token);

      // Set credentials on OAuth2 client
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date,
      });

      // Check if token needs refresh
      const now = Date.now();
      if (tokenData.expiry_date && tokenData.expiry_date <= now) {
        await this.refreshToken();
      }

      // Return Gmail client
      return google.gmail({ version: 'v1', auth: this.oauth2Client });
    } catch (error) {
      console.error('Failed to get Gmail client:', error);
      throw new Error(`Failed to get Gmail client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch messages from Gmail with query and max results
   * @param {string} query - Gmail search query (e.g., 'from:bank@example.com')
   * @param {number} [maxResults=100] - Maximum number of messages to fetch (max 500)
   * @returns {Promise<gmail_v1.Schema$Message[]>} Array of Gmail messages
   * @throws {Error} When Gmail API requests fail
   * @example
   * ```typescript
   * const service = new GmailService('user123');
   * const messages = await service.fetchMessages('from:bank@example.com', 50);
   * console.log(`Found ${messages.length} messages`);
   * ```
   */
  async fetchMessages(query: string, maxResults: number = 100): Promise<gmail_v1.Schema$Message[]> {
    try {
      const gmail = await this.getClient();
      const messages: gmail_v1.Schema$Message[] = [];
      
      // Get message IDs first
      await this.rateLimiter.checkLimit();
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.min(maxResults, 500), // Gmail API limit
      });

      if (!listResponse.data.messages) {
        return [];
      }

      // Fetch full message data for each message ID
      const messageIds = listResponse.data.messages.slice(0, maxResults);
      
      for (const messageRef of messageIds) {
        if (!messageRef.id) continue;
        
        try {
          await this.rateLimiter.checkLimit();
          const messageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'full',
          });
          
          if (messageResponse.data) {
            messages.push(messageResponse.data);
          }
        } catch (error) {
          console.error(`Failed to fetch message ${messageRef.id}:`, error);
          // Continue with other messages
        }
      }

      return messages;
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw new Error(`Failed to fetch messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Setup Gmail push notifications using Pub/Sub
   * @param {string} topicName - Google Cloud Pub/Sub topic name for notifications
   * @returns {Promise<void>} Promise that resolves when watch is set up
   * @throws {Error} When watch setup fails or database operations fail
   * @example
   * ```typescript
   * const service = new GmailService('user123');
   * await service.setupWatch('projects/my-project/topics/gmail-notifications');
   * console.log('Gmail watch notifications enabled');
   * ```
   */
  async setupWatch(topicName: string): Promise<void> {
    try {
      const gmail = await this.getClient();
      
      await this.rateLimiter.checkLimit();
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: topicName,
          labelIds: ['INBOX'], // Watch inbox only
          labelFilterAction: 'include',
        },
      });

      if (!watchResponse.data.historyId) {
        throw new Error('Failed to setup Gmail watch - no history ID returned');
      }

      // Store watch configuration in database
      const supabase = await createClient();
      const watchConfig: GmailWatchConfig = {
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration ? parseInt(watchResponse.data.expiration) : Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days default
      };

      const { error } = await supabase
        .from('gmail_tokens')
        .update({
          watch_config: watchConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', this.userId);

      if (error) {
        throw new Error(`Failed to store watch configuration: ${error.message}`);
      }

      console.log(`Gmail watch setup successful for user ${this.userId}, historyId: ${watchConfig.historyId}`);
    } catch (error) {
      console.error('Failed to setup Gmail watch:', error);
      throw new Error(`Failed to setup Gmail watch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token if expired
   * @returns {Promise<void>} Promise that resolves when token is refreshed
   * @throws {Error} When token refresh fails or database operations fail
   * @example
   * ```typescript
   * const service = new GmailService('user123');
   * await service.refreshToken();
   * console.log('Token refreshed successfully');
   * ```
   */
  async refreshToken(): Promise<void> {
    try {
      await this.rateLimiter.checkLimit();
      
      // Refresh the token
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh token - no access token returned');
      }

      // Update credentials
      this.oauth2Client.setCredentials(credentials);

      // Encrypt and store new tokens
      const supabase = await createClient();
      const updateData: {
        encrypted_access_token: string;
        updated_at: string;
        expiry_date?: number;
        encrypted_refresh_token?: string;
      } = {
        encrypted_access_token: encrypt(credentials.access_token),
        updated_at: new Date().toISOString(),
      };

      if (credentials.expiry_date) {
        updateData.expiry_date = credentials.expiry_date;
      }

      if (credentials.refresh_token) {
        updateData.encrypted_refresh_token = encrypt(credentials.refresh_token);
      }

      const { error } = await supabase
        .from('gmail_tokens')
        .update(updateData)
        .eq('user_id', this.userId);

      if (error) {
        throw new Error(`Failed to update refreshed tokens: ${error.message}`);
      }

      console.log(`Token refreshed successfully for user ${this.userId}`);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get message history since a specific history ID
   * @param {string} startHistoryId - Gmail history ID to start from
   * @returns {Promise<gmail_v1.Schema$History[]>} Array of Gmail history records
   * @throws {Error} When Gmail API requests fail
   * @example
   * ```typescript
   * const service = new GmailService('user123');
   * const history = await service.getHistory('12345');
   * console.log(`Found ${history.length} history records`);
   * ```
   */
  async getHistory(startHistoryId: string): Promise<gmail_v1.Schema$History[]> {
    try {
      const gmail = await this.getClient();
      
      await this.rateLimiter.checkLimit();
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: startHistoryId,
        historyTypes: ['messageAdded'],
      });

      return historyResponse.data.history || [];
    } catch (error) {
      console.error('Failed to get Gmail history:', error);
      throw new Error(`Failed to get Gmail history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific message by ID
   * @param {string} messageId - Gmail message ID to retrieve
   * @returns {Promise<gmail_v1.Schema$Message | null>} Gmail message or null if not found
   * @example
   * ```typescript
   * const service = new GmailService('user123');
   * const message = await service.getMessage('msg123');
   * if (message) {
   *   console.log('Message found:', message.snippet);
   * }
   * ```
   */
  async getMessage(messageId: string): Promise<gmail_v1.Schema$Message | null> {
    try {
      const gmail = await this.getClient();
      
      await this.rateLimiter.checkLimit();
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return messageResponse.data || null;
    } catch (error) {
      console.error(`Failed to get message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Extract email content from Gmail message
   * @static
   * @param {gmail_v1.Schema$Message} message - Gmail message object
   * @returns {Object} Extracted email content
   * @returns {string} returns.subject - Email subject line
   * @returns {string} returns.from - Sender email address
   * @returns {string} returns.body - Email body content
   * @returns {Date} returns.date - Email date
   * @returns {string} returns.messageId - Gmail message ID
   * @example
   * ```typescript
   * const content = GmailService.extractEmailContent(message);
   * console.log(`Subject: ${content.subject}`);
   * console.log(`From: ${content.from}`);
   * ```
   */
  static extractEmailContent(message: gmail_v1.Schema$Message): {
    subject: string;
    from: string;
    body: string;
    date: Date;
    messageId: string;
  } {
    const headers = message.payload?.headers || [];
    
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
    const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
    const messageId = message.id || '';
    
    let date = new Date();
    if (message.internalDate) {
      date = new Date(parseInt(message.internalDate));
    }

    let body = '';

    // Extract body from payload
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      // Look for text/plain or text/html parts
      for (const part of message.payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }
    }

    return { subject, from, body, date, messageId };
  }
}

/**
 * Factory function to create a new Gmail service instance
 * @param {string} userId - The ID of the user to create service for
 * @returns {GmailService} New Gmail service instance
 * @example
 * ```typescript
 * const gmailService = createGmailService('user123');
 * const messages = await gmailService.fetchMessages('from:bank@example.com');
 * ```
 */
export function createGmailService(userId: string): GmailService {
  return new GmailService(userId);
}

export default GmailService;