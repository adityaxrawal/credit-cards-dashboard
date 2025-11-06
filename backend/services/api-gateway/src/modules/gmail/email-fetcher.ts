import { gmail_v1 } from "googleapis";
import { logger } from "../../utils/logger";

/**
 * Normalized email message structure
 */
export interface NormalizedEmail {
  id: string;
  threadId: string;
  historyId: string;
  from: string;
  to: string[];
  subject: string;
  date: Date;
  bodyPlain: string;
  bodyHtml: string;
  labels: string[];
  snippet: string;
  internalDate: number;
}

/**
 * Email Fetcher - Fetches and normalizes Gmail messages
 */
export class EmailFetcher {
  /**
   * Fetch a single email by message ID
   * @param gmail - Gmail API client
   * @param messageId - Gmail message ID
   * @returns Normalized email or null if not found
   */
  async fetchEmail(
    gmail: gmail_v1.Gmail,
    messageId: string
  ): Promise<NormalizedEmail | null> {
    try {
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full", // Get full message with headers and body
      });

      const message = response.data;
      if (!message) {
        return null;
      }

      return this.normalizeMessage(message);
    } catch (error: any) {
      if (error.code === 404) {
        logger.warn({ messageId }, "Email not found");
        return null;
      }
      logger.error({ error, messageId }, "Failed to fetch email");
      throw error;
    }
  }

  /**
   * Fetch multiple emails by message IDs
   * @param gmail - Gmail API client
   * @param messageIds - Array of Gmail message IDs
   * @returns Array of normalized emails
   */
  async fetchEmailsBatch(
    gmail: gmail_v1.Gmail,
    messageIds: string[]
  ): Promise<NormalizedEmail[]> {
    const emails: NormalizedEmail[] = [];

    // Batch in groups of 50 to avoid rate limits
    const batchSize = 50;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((id) => this.fetchEmail(gmail, id))
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled" && result.value) {
          emails.push(result.value);
        }
      }
    }

    return emails;
  }

  /**
   * Normalize Gmail message to consistent structure
   * @param message - Gmail message object
   * @returns Normalized email
   */
  private normalizeMessage(message: gmail_v1.Schema$Message): NormalizedEmail {
    const headers = message.payload?.headers || [];

    // Extract headers
    const from = this.getHeader(headers, "From");
    const to = this.getHeader(headers, "To")
      .split(",")
      .map((e) => e.trim());
    const subject = this.getHeader(headers, "Subject");
    const dateStr = this.getHeader(headers, "Date");
    const date = dateStr
      ? new Date(dateStr)
      : new Date(parseInt(message.internalDate || "0"));

    // Extract body
    const { plain, html } = this.extractBody(message.payload);

    return {
      id: message.id!,
      threadId: message.threadId!,
      historyId: message.historyId!,
      from,
      to,
      subject,
      date,
      bodyPlain: plain,
      bodyHtml: html,
      labels: message.labelIds || [],
      snippet: message.snippet || "",
      internalDate: parseInt(message.internalDate || "0"),
    };
  }

  /**
   * Get header value by name
   * @param headers - Array of message headers
   * @param name - Header name
   * @returns Header value or empty string
   */
  private getHeader(
    headers: gmail_v1.Schema$MessagePartHeader[],
    name: string
  ): string {
    const header = headers.find(
      (h) => h.name?.toLowerCase() === name.toLowerCase()
    );
    return header?.value || "";
  }

  /**
   * Extract plain text and HTML body from message
   * @param payload - Message payload
   * @returns Plain and HTML body content
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
    plain: string;
    html: string;
  } {
    let plain = "";
    let html = "";

    if (!payload) {
      return { plain, html };
    }

    // Check if this part has body data
    if (payload.body?.data) {
      const decoded = this.decodeBase64(payload.body.data);
      const mimeType = payload.mimeType || "";

      if (mimeType.includes("text/plain")) {
        plain = decoded;
      } else if (mimeType.includes("text/html")) {
        html = decoded;
      }
    }

    // Recursively check parts
    if (payload.parts) {
      for (const part of payload.parts) {
        const { plain: p, html: h } = this.extractBody(part);
        if (p) plain = p;
        if (h) html = h;
      }
    }

    return { plain, html };
  }

  /**
   * Decode base64url encoded string
   * @param data - Base64url encoded string
   * @returns Decoded string
   */
  private decodeBase64(data: string): string {
    try {
      // Convert base64url to base64
      const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
      // Decode
      return Buffer.from(base64, "base64").toString("utf-8");
    } catch (error) {
      logger.error({ error }, "Failed to decode base64");
      return "";
    }
  }

  /**
   * List messages matching query
   * @param gmail - Gmail API client
   * @param query - Gmail search query
   * @param maxResults - Maximum number of results
   * @returns Array of message IDs
   */
  async listMessages(
    gmail: gmail_v1.Gmail,
    query: string,
    maxResults: number = 100
  ): Promise<string[]> {
    try {
      const messageIds: string[] = [];
      let pageToken: string | undefined;

      do {
        const response = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: Math.min(maxResults - messageIds.length, 500),
          pageToken,
        });

        const messages = response.data.messages || [];
        messageIds.push(...messages.map((m) => m.id!));

        pageToken = response.data.nextPageToken || undefined;

        // Stop if we have enough messages
        if (messageIds.length >= maxResults) {
          break;
        }
      } while (pageToken);

      return messageIds.slice(0, maxResults);
    } catch (error) {
      logger.error({ error, query }, "Failed to list messages");
      throw error;
    }
  }

  /**
   * Get history of changes since a history ID
   * @param gmail - Gmail API client
   * @param historyId - Starting history ID
   * @returns Array of message IDs that changed
   */
  async getHistory(
    gmail: gmail_v1.Gmail,
    historyId: string
  ): Promise<string[]> {
    try {
      const response = await gmail.users.history.list({
        userId: "me",
        startHistoryId: historyId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });

      const history = response.data.history || [];
      const messageIds = new Set<string>();

      for (const record of history) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            if (added.message?.id) {
              messageIds.add(added.message.id);
            }
          }
        }
      }

      return Array.from(messageIds);
    } catch (error: any) {
      // History ID might be too old (expired)
      if (error.code === 404) {
        logger.warn({ historyId }, "History ID expired or invalid");
        return [];
      }
      logger.error({ error, historyId }, "Failed to get history");
      throw error;
    }
  }
}

// Export singleton
export const emailFetcher = new EmailFetcher();
