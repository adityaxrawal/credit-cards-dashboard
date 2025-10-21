import { google, Auth } from 'googleapis';
import { createClient } from '@/lib/supabase/server';

export interface GmailToken {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      headers?: Array<{ name: string; value: string }>;
    }>;
  };
  internalDate: string;
}

export class GmailClientService {
  private oauth2Client: Auth.OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  /**
   * Get Gmail client for a specific user
   */
  async getGmailClient(userId: string) {
    try {
      const supabase = await createClient();
      
      // Get user's Gmail tokens from database
      const { data: tokenData, error } = await supabase
        .from('gmail_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !tokenData) {
        throw new Error(`No Gmail tokens found for user ${userId}`);
      }

      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date,
      });

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      return gmail;
    } catch (error) {
      console.error('Failed to get Gmail client:', error);
      throw new Error(`Failed to get Gmail client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch historical emails from Gmail
   */
  async fetchHistoricalEmails(userId: string, yearsBack: number = 2): Promise<GmailMessage[]> {
    try {
      const gmail = await this.getGmailClient(userId);
      
      // Calculate date range
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsBack);
      const timestamp = Math.floor(cutoffDate.getTime() / 1000);

      // Search query for credit card related emails
      const query = `after:${timestamp} (from:alerts OR from:notification OR from:statement OR subject:transaction OR subject:statement OR subject:credit OR subject:card OR subject:payment OR subject:spent OR subject:bill)`;

      // Get message IDs
      const messageIds: string[] = [];
      let pageToken: string | undefined;

      do {
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 500,
          pageToken,
        });

        if (response.data.messages) {
          messageIds.push(...response.data.messages.map(msg => msg.id!));
        }

        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken && messageIds.length < 2000); // Limit to prevent overwhelming

      // Fetch full messages in batches
      const messages: GmailMessage[] = [];
      const batchSize = 50;

      for (let i = 0; i < messageIds.length; i += batchSize) {
        const batch = messageIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (messageId) => {
          try {
            const response = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'full',
            });
            return response.data as GmailMessage;
          } catch (error) {
            console.error(`Failed to fetch message ${messageId}:`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        messages.push(...batchResults.filter(msg => msg !== null) as GmailMessage[]);

        // Add small delay between batches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return messages;
    } catch (error) {
      console.error('Failed to fetch historical emails:', error);
      throw new Error(`Failed to fetch historical emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch a specific email by message ID
   */
  async fetchEmailById(userId: string, messageId: string): Promise<GmailMessage> {
    try {
      const gmail = await this.getGmailClient(userId);
      
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return response.data as GmailMessage;
    } catch (error) {
      console.error(`Failed to fetch email ${messageId}:`, error);
      throw new Error(`Failed to fetch email ${messageId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract email content from Gmail message
   */
  extractEmailContent(message: GmailMessage): { subject: string; from: string; body: string; date: Date } {
    const headers = message.payload.headers;
    
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    const date = new Date(parseInt(message.internalDate));

    let body = '';

    // Extract body from payload
    if (message.payload.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload.parts) {
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

    return { subject, from, body, date };
  }

  /**
   * Update Gmail tokens in database
   */
  async updateTokens(userId: string, tokens: GmailToken): Promise<void> {
    try {
      const supabase = await createClient();
      
      const { error } = await supabase
        .from('gmail_tokens')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          scope: tokens.scope,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to update Gmail tokens:', error);
      throw new Error(`Failed to update Gmail tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const gmailClient = new GmailClientService();