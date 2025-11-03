import { emailQueue, QueueMessage } from "../queue/email-queue";
import { gmailClient } from "../gmail-client";
import { emailFetcher } from "../email-fetcher";
import { emailClassifier } from "../classifier/email-classifier";
import { logger } from "../utils/logger";
import { createClient } from "@supabase/supabase-js";

/**
 * Email Processor Worker
 * Processes queued email messages
 */
export class EmailProcessor {
  private supabase;
  private isRunning = false;
  private processingPromise: Promise<void> | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * Start processing queue
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Worker already running");
      return;
    }

    this.isRunning = true;
    logger.info("Email processor worker started");

    // Start processing loop
    this.processingPromise = this.processLoop();

    // Start maintenance tasks
    this.startMaintenanceTasks();
  }

  /**
   * Stop processing
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.processingPromise) {
      await this.processingPromise;
    }
    logger.info("Email processor worker stopped");
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        // Dequeue next message
        const message = await emailQueue.dequeue();

        if (!message) {
          // No messages, wait a bit
          await this.sleep(1000);
          continue;
        }

        // Process message
        await this.processMessage(message);
      } catch (error) {
        logger.error({ error }, "Error in processing loop");
        await this.sleep(5000); // Wait before retrying
      }
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: QueueMessage): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(
        {
          messageId: message.id,
          emailId: message.emailMessageId,
          userId: message.userId,
          attempt: message.attempts + 1,
        },
        "Processing message"
      );

      // 1. Fetch email from Gmail
      const gmail = await gmailClient.initializeForUser(message.userId);
      const email = await emailFetcher.fetchEmail(gmail, message.emailMessageId);

      if (!email) {
        logger.warn(
          { messageId: message.id, emailId: message.emailMessageId },
          "Email not found, skipping"
        );
        await emailQueue.ack(message.id);
        return;
      }

      // 2. Classify email
      const classification = await emailClassifier.classify(email);

      // 3. Log email processing
      await this.logEmailProcessing(
        message.userId,
        email,
        classification,
        "processed"
      );

      // 4. If transaction, extract and store (Week 7 implementation)
      if (classification.classification === "transaction") {
        logger.info(
          {
            messageId: message.id,
            emailId: email.id,
            bankName: classification.bankName,
            confidence: classification.confidence,
          },
          "Transaction email detected - extraction will be implemented in Week 7"
        );
        // Placeholder: extraction will be added in Week 7
      }

      // 5. Acknowledge successful processing
      await emailQueue.ack(message.id);

      const duration = Date.now() - startTime;
      logger.info(
        {
          messageId: message.id,
          emailId: email.id,
          classification: classification.classification,
          duration,
        },
        "Message processed successfully"
      );

      // Emit metrics
      await this.emitMetric("email_processing_duration_ms", duration);
      await this.emitMetric("email_classification", 1, {
        type: classification.classification,
      });
    } catch (error: any) {
      logger.error(
        {
          error,
          messageId: message.id,
          emailId: message.emailMessageId,
        },
        "Failed to process message"
      );

      // Requeue for retry
      await emailQueue.requeue(message.id, error);

      await this.emitMetric("email_processing_error", 1);
    }
  }

  /**
   * Log email processing to database
   */
  private async logEmailProcessing(
    userId: string,
    email: any,
    classification: any,
    status: string
  ): Promise<void> {
    try {
      await this.supabase.from("email_processing_log").upsert(
        {
          user_id: userId,
          email_message_id: email.id,
          from_email: email.from,
          subject: email.subject,
          status,
          classification_result: classification,
          processed_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,email_message_id",
        }
      );
    } catch (error) {
      logger.error({ error }, "Failed to log email processing");
    }
  }

  /**
   * Start maintenance tasks
   */
  private startMaintenanceTasks(): void {
    // Process delayed messages every 30 seconds
    setInterval(async () => {
      if (this.isRunning) {
        await emailQueue.processDelayedMessages();
      }
    }, 30000);

    // Check visibility timeouts every minute
    setInterval(async () => {
      if (this.isRunning) {
        await emailQueue.recheckVisibilityTimeouts();
      }
    }, 60000);

    // Log queue stats every 5 minutes
    setInterval(async () => {
      if (this.isRunning) {
        const stats = await emailQueue.getStats();
        logger.info({ stats }, "Queue statistics");
        await this.emitMetric("queue_pending", stats.pending);
        await this.emitMetric("queue_processing", stats.processing);
        await this.emitMetric("queue_delayed", stats.delayed);
        await this.emitMetric("queue_dlq", stats.dlq);
      }
    }, 300000);
  }

  /**
   * Emit metric
   */
  private async emitMetric(
    metricType: string,
    value: number,
    dimensions?: Record<string, string>
  ): Promise<void> {
    try {
      await this.supabase.from("email_processing_metrics").insert({
        metric_type: metricType,
        metric_value: value,
        dimensions: dimensions || {},
      });
    } catch (error) {
      logger.debug({ error }, "Failed to emit metric");
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton
export const emailProcessor = new EmailProcessor();
