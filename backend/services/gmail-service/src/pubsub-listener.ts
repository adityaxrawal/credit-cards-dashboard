import { PubSub, Message } from "@google-cloud/pubsub";
import { gmailWatchManager } from "./watch-manager";

const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID,
});

const subscriptionName = process.env.GMAIL_PUBSUB_SUBSCRIPTION || "gmail-notifications-sub";

/**
 * Pub/Sub listener for Gmail push notifications
 */
export class GmailPubSubListener {
  private subscription: any;

  constructor() {
    this.subscription = pubsub.subscription(subscriptionName);
  }

  /**
   * Start listening to Pub/Sub messages
   */
  start(): void {
    console.log(`Starting Pub/Sub listener on subscription: ${subscriptionName}`);

    // Handle incoming messages
    this.subscription.on("message", this.handleMessage.bind(this));

    // Handle errors
    this.subscription.on("error", (error: Error) => {
      console.error("Pub/Sub subscription error:", error);
    });

    console.log("Pub/Sub listener started successfully");
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (this.subscription) {
      this.subscription.removeAllListeners();
      console.log("Pub/Sub listener stopped");
    }
  }

  /**
   * Handle incoming Pub/Sub message
   */
  private async handleMessage(message: Message): Promise<void> {
    try {
      // Parse message data
      const data = message.data ? JSON.parse(message.data.toString()) : {};

      console.log("Received Pub/Sub message:", {
        messageId: message.id,
        data,
      });

      // Extract email address and history ID from notification
      const emailAddress = data.emailAddress;
      const historyId = data.historyId;

      if (!emailAddress || !historyId) {
        console.warn("Invalid Pub/Sub message: missing emailAddress or historyId");
        message.ack();
        return;
      }

      // Process notification using watch manager
      const result = await gmailWatchManager.processNotification({
        emailAddress,
        historyId,
      });

      console.log("Notification processed:", {
        userId: result.userId,
        messageCount: result.messageIds.length,
        newHistoryId: result.newHistoryId,
      });

      // Queue message IDs for processing
      if (result.messageIds.length > 0) {
        await this.queueMessages(result.userId, result.messageIds);
      }

      // Acknowledge message
      message.ack();
    } catch (error) {
      console.error("Error handling Pub/Sub message:", error);

      // Nack the message to retry later
      message.nack();
    }
  }

  /**
   * Queue message IDs for email processing
   */
  private async queueMessages(userId: string, messageIds: string[]): Promise<void> {
    console.log(`Queuing ${messageIds.length} messages for user ${userId}`);

    // Import email queue dynamically to avoid circular dependency
    const { emailQueue } = await import("./email-queue");

    // Add messages to Bull queue for processing
    await emailQueue.addFetchEmailJobs(userId, messageIds);

    console.log(`Successfully queued ${messageIds.length} messages for processing`);
  }
}

// Export singleton instance
export const gmailPubSubListener = new GmailPubSubListener();
