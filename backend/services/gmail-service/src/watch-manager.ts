import { gmail_v1 } from "googleapis";
import { gmailClient } from "./gmail-client";
import { createClient } from "@supabase/supabase-js";

/**
 * Gmail Watch Manager
 * Manages Gmail Push Notifications via Pub/Sub
 * Handles watch setup, renewal, and expiration tracking
 */
export class GmailWatchManager {
  private supabase;
  private readonly WATCH_DURATION_DAYS = 7; // Gmail max is 7 days
  private readonly RENEW_BEFORE_HOURS = 24; // Renew 24 hours before expiration

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * Setup watch for a user's Gmail inbox
   * @param userId - User ID
   * @param gmail - Initialized Gmail API client
   * @returns Watch response with expiration
   */
  async setupWatch(
    userId: string,
    gmail: gmail_v1.Gmail
  ): Promise<{
    historyId: string;
    expiration: Date;
  }> {
    try {
      // Stop existing watch if any
      await this.stopWatch(userId, gmail).catch(() => {
        // Ignore errors if no watch exists
      });

      // Setup new watch
      const response = await gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName: process.env.GMAIL_PUBSUB_TOPIC!, // e.g., projects/PROJECT_ID/topics/gmail-notifications
          labelIds: ["INBOX"], // Watch only inbox
          labelFilterAction: "include", // Only include messages with these labels
        },
      });

      const historyId = response.data.historyId!;
      const expirationMs = parseInt(response.data.expiration!);
      const expiration = new Date(expirationMs);

      // Store watch details in database
      await this.supabase
        .from("users")
        .update({
          gmail_history_id: historyId,
          gmail_watch_expiration: expiration.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      console.log(`Gmail watch setup for user ${userId}, expires: ${expiration}`);

      return {
        historyId,
        expiration,
      };
    } catch (error) {
      console.error(`Error setting up Gmail watch for user ${userId}:`, error);
      throw new Error("Failed to setup Gmail watch");
    }
  }

  /**
   * Stop watch for a user
   * @param userId - User ID
   * @param gmail - Initialized Gmail API client
   */
  async stopWatch(userId: string, gmail: gmail_v1.Gmail): Promise<void> {
    try {
      await gmail.users.stop({
        userId: "me",
      });

      // Clear watch details from database
      await this.supabase
        .from("users")
        .update({
          gmail_watch_expiration: null,
          gmail_history_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      console.log(`Gmail watch stopped for user ${userId}`);
    } catch (error) {
      console.error(`Error stopping Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if watch needs renewal for a user
   * @param userId - User ID
   * @returns True if watch needs renewal
   */
  async needsRenewal(userId: string): Promise<boolean> {
    try {
      const { data: user } = await this.supabase
        .from("users")
        .select("gmail_watch_expiration")
        .eq("id", userId)
        .single();

      if (!user?.gmail_watch_expiration) {
        return true; // No watch setup
      }

      const expiration = new Date(user.gmail_watch_expiration);
      const renewTime = new Date(
        expiration.getTime() - this.RENEW_BEFORE_HOURS * 60 * 60 * 1000
      );

      return new Date() >= renewTime;
    } catch (error) {
      console.error(`Error checking watch renewal for user ${userId}:`, error);
      return true; // Assume renewal needed on error
    }
  }

  /**
   * Renew watch for a user if needed
   * @param userId - User ID
   * @returns True if renewed, false if not needed
   */
  async renewIfNeeded(userId: string): Promise<boolean> {
    try {
      const needsRenewal = await this.needsRenewal(userId);

      if (!needsRenewal) {
        return false;
      }

      // Initialize Gmail for user and setup watch
      const gmail = await gmailClient.initializeForUser(userId);
      await this.setupWatch(userId, gmail);

      console.log(`Gmail watch renewed for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error renewing watch for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get watch status for a user
   * @param userId - User ID
   * @returns Watch status details
   */
  async getWatchStatus(userId: string): Promise<{
    active: boolean;
    expiration: Date | null;
    historyId: string | null;
    needsRenewal: boolean;
  }> {
    try {
      const { data: user } = await this.supabase
        .from("users")
        .select("gmail_watch_expiration, gmail_history_id")
        .eq("id", userId)
        .single();

      const expiration = user?.gmail_watch_expiration
        ? new Date(user.gmail_watch_expiration)
        : null;
      const active = expiration ? expiration > new Date() : false;
      const needsRenewal = await this.needsRenewal(userId);

      return {
        active,
        expiration,
        historyId: user?.gmail_history_id || null,
        needsRenewal,
      };
    } catch (error) {
      console.error(`Error getting watch status for user ${userId}:`, error);
      return {
        active: false,
        expiration: null,
        historyId: null,
        needsRenewal: true,
      };
    }
  }

  /**
   * Renew all expiring watches
   * Should be called by a cron job every hour
   */
  async renewAllExpiringWatches(): Promise<{
    renewed: number;
    failed: number;
  }> {
    let renewed = 0;
    let failed = 0;

    try {
      // Get all users with Gmail connected
      const { data: users } = await this.supabase
        .from("users")
        .select("id, gmail_watch_expiration")
        .not("gmail_refresh_token", "is", null);

      if (!users || users.length === 0) {
        return { renewed, failed };
      }

      // Check and renew each user's watch
      for (const user of users) {
        try {
          const didRenew = await this.renewIfNeeded(user.id);
          if (didRenew) {
            renewed++;
          }
        } catch (error) {
          console.error(`Failed to renew watch for user ${user.id}:`, error);
          failed++;
        }
      }

      console.log(`Watch renewal complete: ${renewed} renewed, ${failed} failed`);
    } catch (error) {
      console.error("Error in renewAllExpiringWatches:", error);
    }

    return { renewed, failed };
  }

  /**
   * Get history changes since last sync
   * @param userId - User ID
   * @param gmail - Initialized Gmail API client
   * @param startHistoryId - History ID to start from
   * @returns Array of history records
   */
  async getHistory(
    userId: string,
    gmail: gmail_v1.Gmail,
    startHistoryId: string
  ): Promise<gmail_v1.Schema$History[]> {
    try {
      const response = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"], // Only new messages
        labelId: "INBOX", // Only inbox messages
      });

      return response.data.history || [];
    } catch (error) {
      // History ID might be too old or invalid
      if ((error as any).code === 404) {
        console.log(`History ID ${startHistoryId} not found for user ${userId}, performing full sync`);
        return [];
      }

      console.error(`Error fetching history for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Process Pub/Sub notification
   * @param notification - Pub/Sub message data
   * @returns Array of new message IDs to process
   */
  async processNotification(notification: {
    emailAddress: string;
    historyId: string;
  }): Promise<{
    userId: string;
    messageIds: string[];
    newHistoryId: string;
  }> {
    try {
      // Find user by email
      const { data: user } = await this.supabase
        .from("users")
        .select("id, gmail_history_id")
        .eq("email", notification.emailAddress)
        .single();

      if (!user) {
        throw new Error(`User not found for email: ${notification.emailAddress}`);
      }

      const userId = user.id;
      const lastHistoryId = user.gmail_history_id;

      if (!lastHistoryId) {
        // First sync, just update history ID
        await this.supabase
          .from("users")
          .update({
            gmail_history_id: notification.historyId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        return {
          userId,
          messageIds: [],
          newHistoryId: notification.historyId,
        };
      }

      // Get history changes
      const gmail = await gmailClient.initializeForUser(userId);
      const history = await this.getHistory(userId, gmail, lastHistoryId);

      // Extract message IDs from history
      const messageIds: string[] = [];
      for (const record of history) {
        if (record.messagesAdded) {
          for (const msg of record.messagesAdded) {
            if (msg.message?.id) {
              messageIds.push(msg.message.id);
            }
          }
        }
      }

      // Update history ID
      await this.supabase
        .from("users")
        .update({
          gmail_history_id: notification.historyId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      return {
        userId,
        messageIds,
        newHistoryId: notification.historyId,
      };
    } catch (error) {
      console.error("Error processing Pub/Sub notification:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const gmailWatchManager = new GmailWatchManager();
