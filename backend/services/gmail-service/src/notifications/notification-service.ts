import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface Notification {
  id?: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at?: string;
}

/**
 * Notification Service
 * Manages in-app notifications and optionally email notifications
 */
export class NotificationService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * Create notification
   */
  async createNotification(notification: Omit<Notification, "id" | "read" | "created_at">): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .insert({
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: false,
        })
        .select("id")
        .single();

      if (error) throw error;

      logger.info(
        { userId: notification.user_id, title: notification.title },
        "Notification created"
      );

      return data?.id || null;
    } catch (error) {
      logger.error({ error, notification }, "Failed to create notification");
      return null;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    try {
      const { data, error } = await this.supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error({ error, userId }, "Failed to get notifications");
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      return true;
    } catch (error) {
      logger.error({ error, notificationId }, "Failed to mark as read");
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) throw error;

      return true;
    } catch (error) {
      logger.error({ error, userId }, "Failed to mark all as read");
      return false;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      return true;
    } catch (error) {
      logger.error({ error, notificationId }, "Failed to delete notification");
      return false;
    }
  }

  /**
   * Notify scan completion
   */
  async notifyScanCompletion(
    userId: string,
    jobId: string,
    stats: {
      totalMessages: number;
      extractedTransactions: number;
      failedMessages: number;
    }
  ): Promise<void> {
    await this.createNotification({
      user_id: userId,
      type: "success",
      title: "Historical Scan Complete",
      message: `Processed ${stats.totalMessages} emails, extracted ${stats.extractedTransactions} transactions.`,
    });
  }

  /**
   * Notify scan failure
   */
  async notifyScanFailure(userId: string, jobId: string, error: string): Promise<void> {
    await this.createNotification({
      user_id: userId,
      type: "error",
      title: "Historical Scan Failed",
      message: `Scan job failed: ${error}`,
    });
  }

  /**
   * Notify manual review needed
   */
  async notifyManualReviewNeeded(userId: string, count: number): Promise<void> {
    await this.createNotification({
      user_id: userId,
      type: "warning",
      title: "Manual Review Required",
      message: `${count} transaction${count > 1 ? "s" : ""} require manual review.`,
    });
  }

  /**
   * Notify new transactions extracted
   */
  async notifyNewTransactions(userId: string, count: number): Promise<void> {
    await this.createNotification({
      user_id: userId,
      type: "info",
      title: "New Transactions",
      message: `${count} new transaction${count > 1 ? "s" : ""} extracted from emails.`,
    });
  }
}

// Export singleton
export const notificationService = new NotificationService();
