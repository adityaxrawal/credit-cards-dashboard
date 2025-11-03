import Redis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";
import crypto from "crypto";

/**
 * Queue item status
 */
export type QueueStatus = "pending" | "processing" | "processed" | "failed" | "retry";

/**
 * Queue message structure
 */
export interface QueueMessage {
  id: string;
  userId: string;
  emailMessageId: string;
  gmailHistoryId?: string;
  status: QueueStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  visibilityTimeout?: Date;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  payload?: any;
}

/**
 * Email Processing Queue
 * Handles message queueing with visibility timeout, retries, and DLQ
 */
export class EmailQueue {
  private redis: Redis;
  private supabase;
  private readonly QUEUE_KEY = "email:queue";
  private readonly PROCESSING_KEY = "email:processing";
  private readonly DLQ_KEY = "email:dlq";
  private readonly VISIBILITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;

  constructor() {
    // Initialize Redis
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    // Initialize Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Handle Redis errors
    this.redis.on("error", (err) => {
      logger.error({ error: err }, "Redis connection error");
    });

    this.redis.on("connect", () => {
      logger.info("Redis connected successfully");
    });
  }

  /**
   * Enqueue a message for processing
   * @param userId - User ID
   * @param emailMessageId - Gmail message ID
   * @param gmailHistoryId - Gmail history ID
   * @returns Queue message ID
   */
  async enqueue(
    userId: string,
    emailMessageId: string,
    gmailHistoryId?: string
  ): Promise<string> {
    try {
      // Generate unique message ID
      const messageId = crypto.randomUUID();

      // Check if message already queued (idempotency)
      const existing = await this.supabase
        .from("email_processing_queue")
        .select("id, status")
        .eq("user_id", userId)
        .eq("email_message_id", emailMessageId)
        .single();

      if (existing.data) {
        // If already processed, skip
        if (existing.data.status === "processed") {
          logger.info(
            { userId, emailMessageId },
            "Message already processed, skipping"
          );
          return existing.data.id;
        }
        // If in queue, return existing ID
        logger.info({ userId, emailMessageId }, "Message already in queue");
        return existing.data.id;
      }

      // Create queue record in database
      const { data: queueItem, error } = await this.supabase
        .from("email_processing_queue")
        .insert({
          id: messageId,
          user_id: userId,
          email_message_id: emailMessageId,
          gmail_history_id: gmailHistoryId,
          status: "pending",
          attempts: 0,
          max_attempts: this.MAX_ATTEMPTS,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add to Redis queue
      await this.redis.lpush(this.QUEUE_KEY, messageId);

      logger.info(
        { messageId, userId, emailMessageId },
        "Message enqueued successfully"
      );

      // Emit metric
      await this.emitMetric("email_enqueued", 1, { userId });

      return messageId;
    } catch (error) {
      logger.error({ error, userId, emailMessageId }, "Failed to enqueue message");
      throw error;
    }
  }

  /**
   * Dequeue a message for processing
   * Sets visibility timeout to prevent duplicate processing
   * @returns Queue message or null if queue is empty
   */
  async dequeue(): Promise<QueueMessage | null> {
    try {
      // Move message from queue to processing with timeout
      const messageId = await this.redis.brpoplpush(
        this.QUEUE_KEY,
        this.PROCESSING_KEY,
        1 // 1 second timeout
      );

      if (!messageId) {
        return null;
      }

      // Get message details from database
      const { data: queueItem, error } = await this.supabase
        .from("email_processing_queue")
        .select("*")
        .eq("id", messageId)
        .single();

      if (error || !queueItem) {
        // Remove from processing if not found
        await this.redis.lrem(this.PROCESSING_KEY, 1, messageId);
        logger.warn({ messageId }, "Queue item not found in database");
        return null;
      }

      // Set visibility timeout
      const visibilityTimeout = new Date(Date.now() + this.VISIBILITY_TIMEOUT_MS);
      await this.supabase
        .from("email_processing_queue")
        .update({
          status: "processing",
          visibility_timeout: visibilityTimeout.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      logger.info({ messageId }, "Message dequeued for processing");

      return {
        id: queueItem.id,
        userId: queueItem.user_id,
        emailMessageId: queueItem.email_message_id,
        gmailHistoryId: queueItem.gmail_history_id,
        status: "processing",
        attempts: queueItem.attempts,
        maxAttempts: queueItem.max_attempts,
        lastError: queueItem.last_error,
        visibilityTimeout,
        createdAt: new Date(queueItem.created_at),
        updatedAt: new Date(queueItem.updated_at),
        processedAt: queueItem.processed_at
          ? new Date(queueItem.processed_at)
          : undefined,
      };
    } catch (error) {
      logger.error({ error }, "Failed to dequeue message");
      return null;
    }
  }

  /**
   * Mark message as successfully processed
   * @param messageId - Queue message ID
   */
  async ack(messageId: string): Promise<void> {
    try {
      // Remove from processing list
      await this.redis.lrem(this.PROCESSING_KEY, 1, messageId);

      // Update database
      await this.supabase
        .from("email_processing_queue")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      logger.info({ messageId }, "Message acknowledged successfully");

      // Emit metric
      await this.emitMetric("email_processed", 1);
    } catch (error) {
      logger.error({ error, messageId }, "Failed to acknowledge message");
      throw error;
    }
  }

  /**
   * Requeue message for retry with exponential backoff
   * @param messageId - Queue message ID
   * @param error - Error that caused failure
   */
  async requeue(messageId: string, error: Error): Promise<void> {
    try {
      // Get current attempts
      const { data: queueItem } = await this.supabase
        .from("email_processing_queue")
        .select("attempts, max_attempts")
        .eq("id", messageId)
        .single();

      if (!queueItem) {
        throw new Error("Queue item not found");
      }

      const attempts = queueItem.attempts + 1;

      // Check if max attempts reached
      if (attempts >= queueItem.max_attempts) {
        logger.warn(
          { messageId, attempts, maxAttempts: queueItem.max_attempts },
          "Max retry attempts reached, moving to DLQ"
        );
        await this.moveToDLQ(messageId, error.message);
        return;
      }

      // Calculate exponential backoff delay
      const delayMs = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s, etc.

      // Remove from processing
      await this.redis.lrem(this.PROCESSING_KEY, 1, messageId);

      // Update database
      await this.supabase
        .from("email_processing_queue")
        .update({
          status: "retry",
          attempts,
          last_error: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      // Requeue with delay using sorted set
      const score = Date.now() + delayMs;
      await this.redis.zadd("email:delayed", score, messageId);

      logger.info(
        { messageId, attempts, delayMs },
        "Message requeued for retry"
      );

      // Emit metric
      await this.emitMetric("email_retry", 1, { attempts: attempts.toString() });
    } catch (error) {
      logger.error({ error, messageId }, "Failed to requeue message");
      throw error;
    }
  }

  /**
   * Move message to dead letter queue
   * @param messageId - Queue message ID
   * @param errorMessage - Final error message
   */
  async moveToDLQ(messageId: string, errorMessage: string): Promise<void> {
    try {
      // Remove from processing
      await this.redis.lrem(this.PROCESSING_KEY, 1, messageId);

      // Get queue item details
      const { data: queueItem } = await this.supabase
        .from("email_processing_queue")
        .select("*")
        .eq("id", messageId)
        .single();

      if (queueItem) {
        // Insert into DLQ table
        await this.supabase.from("email_processing_dlq").insert({
          queue_item_id: messageId,
          user_id: queueItem.user_id,
          email_message_id: queueItem.email_message_id,
          payload: queueItem,
          error_message: errorMessage,
          attempts: queueItem.attempts,
        });

        // Update queue item status
        await this.supabase
          .from("email_processing_queue")
          .update({
            status: "failed",
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", messageId);
      }

      // Add to Redis DLQ
      await this.redis.lpush(this.DLQ_KEY, messageId);

      logger.error({ messageId, errorMessage }, "Message moved to DLQ");

      // Emit metric
      await this.emitMetric("email_dlq", 1);
    } catch (error) {
      logger.error({ error, messageId }, "Failed to move message to DLQ");
      throw error;
    }
  }

  /**
   * Process delayed messages (from retries)
   * Moves messages from delayed set back to main queue when ready
   */
  async processDelayedMessages(): Promise<number> {
    try {
      const now = Date.now();

      // Get messages ready to be processed
      const ready = await this.redis.zrangebyscore(
        "email:delayed",
        0,
        now,
        "LIMIT",
        0,
        100
      );

      if (ready.length === 0) {
        return 0;
      }

      // Move to main queue
      for (const messageId of ready) {
        await this.redis.lpush(this.QUEUE_KEY, messageId);
        await this.redis.zrem("email:delayed", messageId);

        // Update status
        await this.supabase
          .from("email_processing_queue")
          .update({
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", messageId);
      }

      logger.info({ count: ready.length }, "Processed delayed messages");

      return ready.length;
    } catch (error) {
      logger.error({ error }, "Failed to process delayed messages");
      return 0;
    }
  }

  /**
   * Check and requeue messages with expired visibility timeout
   */
  async recheckVisibilityTimeouts(): Promise<number> {
    try {
      const now = new Date();

      // Find messages with expired visibility timeout still marked as processing
      const { data: expiredItems } = await this.supabase
        .from("email_processing_queue")
        .select("id")
        .eq("status", "processing")
        .lt("visibility_timeout", now.toISOString());

      if (!expiredItems || expiredItems.length === 0) {
        return 0;
      }

      // Requeue expired messages
      for (const item of expiredItems) {
        await this.redis.lrem(this.PROCESSING_KEY, 1, item.id);
        await this.redis.lpush(this.QUEUE_KEY, item.id);

        await this.supabase
          .from("email_processing_queue")
          .update({
            status: "pending",
            updated_at: now.toISOString(),
          })
          .eq("id", item.id);
      }

      logger.warn(
        { count: expiredItems.length },
        "Requeued messages with expired visibility timeout"
      );

      return expiredItems.length;
    } catch (error) {
      logger.error({ error }, "Failed to check visibility timeouts");
      return 0;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    delayed: number;
    dlq: number;
  }> {
    try {
      const [pending, processing, delayed, dlq] = await Promise.all([
        this.redis.llen(this.QUEUE_KEY),
        this.redis.llen(this.PROCESSING_KEY),
        this.redis.zcard("email:delayed"),
        this.redis.llen(this.DLQ_KEY),
      ]);

      return { pending, processing, delayed, dlq };
    } catch (error) {
      logger.error({ error }, "Failed to get queue stats");
      return { pending: 0, processing: 0, delayed: 0, dlq: 0 };
    }
  }

  /**
   * Emit metric to database
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
      // Don't fail on metric errors
      logger.debug({ error, metricType }, "Failed to emit metric");
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Export singleton
export const emailQueue = new EmailQueue();
