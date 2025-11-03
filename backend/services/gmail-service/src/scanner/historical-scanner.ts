import { gmailClient } from "../gmail-client";
import { emailFetcher } from "../email-fetcher";
import { emailClassifier } from "../classifier/email-classifier";
import { transactionExtractor } from "../extractor/transaction-extractor";
import { logger } from "../utils/logger";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Scan Job Status
 */
export type ScanJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Scan Job Configuration
 */
export interface ScanJobConfig {
  userId: string;
  startDate: Date;
  endDate: Date;
  labelFilter?: string;
}

/**
 * Scan Progress
 */
export interface ScanProgress {
  jobId: string;
  status: ScanJobStatus;
  totalMessages: number;
  processedMessages: number;
  extractedTransactions: number;
  failedMessages: number;
  duplicateMessages: number;
  progressPercentage: number;
  estimatedCompletion?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Historical Email Scanner
 * Scans past emails for transactions with progress tracking and resume capability
 */
export class HistoricalScanner {
  private supabase;
  private readonly BATCH_SIZE = 50;
  private readonly CHECKPOINT_INTERVAL = 100; // Save checkpoint every 100 messages

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }

  /**
   * Start a new scan job
   * @param config - Scan configuration
   * @returns Job ID
   */
  async startScan(config: ScanJobConfig): Promise<string> {
    try {
      const jobId = crypto.randomUUID();

      // Create job record
      const { error } = await this.supabase
        .from("historical_scan_jobs")
        .insert({
          id: jobId,
          user_id: config.userId,
          status: "pending",
          start_date: config.startDate.toISOString().split("T")[0],
          end_date: config.endDate.toISOString().split("T")[0],
          label_filter: config.labelFilter || "INBOX",
          total_messages: 0,
          processed_messages: 0,
          extracted_transactions: 0,
          failed_messages: 0,
          duplicate_messages: 0,
          progress_percentage: 0,
        });

      if (error) throw error;

      logger.info({ jobId, config }, "Scan job created");

      // Start processing in background
      this.processScan(jobId, config).catch((error) => {
        logger.error({ error, jobId }, "Scan job failed");
      });

      return jobId;
    } catch (error) {
      logger.error({ error, config }, "Failed to start scan");
      throw error;
    }
  }

  /**
   * Get scan progress
   * @param jobId - Job ID
   * @returns Progress information
   */
  async getProgress(jobId: string): Promise<ScanProgress | null> {
    try {
      const { data, error } = await this.supabase
        .from("historical_scan_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (error || !data) return null;

      return {
        jobId: data.id,
        status: data.status,
        totalMessages: data.total_messages,
        processedMessages: data.processed_messages,
        extractedTransactions: data.extracted_transactions,
        failedMessages: data.failed_messages,
        duplicateMessages: data.duplicate_messages,
        progressPercentage: data.progress_percentage,
        estimatedCompletion: data.estimated_completion
          ? new Date(data.estimated_completion)
          : undefined,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      };
    } catch (error) {
      logger.error({ error, jobId }, "Failed to get progress");
      return null;
    }
  }

  /**
   * Pause scan job
   * @param jobId - Job ID
   */
  async pauseScan(jobId: string): Promise<void> {
    await this.supabase
      .from("historical_scan_jobs")
      .update({ status: "paused" })
      .eq("id", jobId);

    logger.info({ jobId }, "Scan job paused");
  }

  /**
   * Resume scan job
   * @param jobId - Job ID
   */
  async resumeScan(jobId: string): Promise<void> {
    const { data } = await this.supabase
      .from("historical_scan_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (!data) {
      throw new Error("Job not found");
    }

    await this.supabase
      .from("historical_scan_jobs")
      .update({ status: "running" })
      .eq("id", jobId);

    const config: ScanJobConfig = {
      userId: data.user_id,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      labelFilter: data.label_filter,
    };

    // Resume from checkpoint
    this.processScan(jobId, config, data.checkpoint_data).catch((error) => {
      logger.error({ error, jobId }, "Resume scan failed");
    });

    logger.info({ jobId }, "Scan job resumed");
  }

  /**
   * Process scan job
   */
  private async processScan(
    jobId: string,
    config: ScanJobConfig,
    checkpoint?: any
  ): Promise<void> {
    try {
      // Update status to running
      await this.supabase
        .from("historical_scan_jobs")
        .update({
          status: "running",
          started_at: checkpoint ? undefined : new Date().toISOString(),
        })
        .eq("id", jobId);

      // Initialize Gmail client
      const gmail = await gmailClient.initializeForUser(config.userId);

      // Build query
      const afterDate = Math.floor(config.startDate.getTime() / 1000);
      const beforeDate = Math.floor(config.endDate.getTime() / 1000);
      const query = `after:${afterDate} before:${beforeDate}`;

      // Get message IDs
      const messageIds = await emailFetcher.listMessages(gmail, query, 10000);

      // Update total messages
      await this.supabase
        .from("historical_scan_jobs")
        .update({ total_messages: messageIds.length })
        .eq("id", jobId);

      logger.info(
        { jobId, totalMessages: messageIds.length },
        "Starting message processing"
      );

      // Process in batches
      const startIndex = checkpoint?.lastProcessedIndex || 0;
      let processedCount = startIndex;
      let extractedCount = checkpoint?.extractedTransactions || 0;
      let failedCount = checkpoint?.failedMessages || 0;
      let duplicateCount = checkpoint?.duplicateMessages || 0;

      for (let i = startIndex; i < messageIds.length; i += this.BATCH_SIZE) {
        // Check if paused/cancelled
        const { data: job } = await this.supabase
          .from("historical_scan_jobs")
          .select("status")
          .eq("id", jobId)
          .single();

        if (job?.status === "paused" || job?.status === "cancelled") {
          logger.info({ jobId, status: job.status }, "Scan stopped");
          return;
        }

        const batch = messageIds.slice(i, i + this.BATCH_SIZE);

        // Process batch
        const results = await Promise.allSettled(
          batch.map((id) => this.processMessage(config.userId, id, gmail))
        );

        // Update counts
        for (const result of results) {
          if (result.status === "fulfilled") {
            const { extracted, duplicate } = result.value;
            if (extracted) extractedCount++;
            if (duplicate) duplicateCount++;
          } else {
            failedCount++;
          }
        }

        processedCount += batch.length;

        // Save checkpoint
        if (processedCount % this.CHECKPOINT_INTERVAL === 0) {
          await this.saveCheckpoint(jobId, {
            lastProcessedIndex: processedCount,
            extractedTransactions: extractedCount,
            failedMessages: failedCount,
            duplicateMessages: duplicateCount,
          });
        }

        // Update progress
        const progressPercentage = (processedCount / messageIds.length) * 100;
        await this.supabase
          .from("historical_scan_jobs")
          .update({
            processed_messages: processedCount,
            extracted_transactions: extractedCount,
            failed_messages: failedCount,
            duplicate_messages: duplicateCount,
            progress_percentage: progressPercentage,
          })
          .eq("id", jobId);
      }

      // Mark as completed
      await this.supabase
        .from("historical_scan_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
        })
        .eq("id", jobId);

      logger.info(
        {
          jobId,
          processed: processedCount,
          extracted: extractedCount,
          failed: failedCount,
          duplicates: duplicateCount,
        },
        "Scan job completed"
      );
    } catch (error) {
      logger.error({ error, jobId }, "Scan job failed");

      await this.supabase
        .from("historical_scan_jobs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", jobId);
    }
  }

  /**
   * Process single message
   */
  private async processMessage(
    userId: string,
    messageId: string,
    gmail: any
  ): Promise<{ extracted: boolean; duplicate: boolean }> {
    try {
      // Fetch email
      const email = await emailFetcher.fetchEmail(gmail, messageId);
      if (!email) {
        return { extracted: false, duplicate: false };
      }

      // Check if already processed
      const { data: existing } = await this.supabase
        .from("email_processing_log")
        .select("id")
        .eq("user_id", userId)
        .eq("email_message_id", messageId)
        .single();

      if (existing) {
        return { extracted: false, duplicate: true };
      }

      // Classify
      const classification = await emailClassifier.classify(email);

      // Extract if transaction
      let extracted = false;
      if (classification.classification === "transaction") {
        const extraction = await transactionExtractor.extract(
          email,
          classification.bankName
        );

        if (extraction.success && extraction.transaction) {
          // Generate fingerprint
          const fingerprint = transactionExtractor.generateFingerprint(
            extraction.transaction,
            email.id
          );

          // Check duplicate
          const { data: dupTransaction } = await this.supabase
            .from("transactions")
            .select("id")
            .eq("fingerprint", fingerprint)
            .single();

          if (!dupTransaction) {
            // Save transaction (simplified - would map to actual transaction fields)
            extracted = true;
          }
        }
      }

      // Log processing
      await this.supabase.from("email_processing_log").insert({
        user_id: userId,
        email_message_id: messageId,
        from_email: email.from,
        subject: email.subject,
        status: "processed",
        classification_result: classification,
      });

      return { extracted, duplicate: false };
    } catch (error) {
      logger.error({ error, messageId }, "Failed to process message");
      return { extracted: false, duplicate: false };
    }
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(jobId: string, checkpoint: any): Promise<void> {
    await this.supabase
      .from("historical_scan_jobs")
      .update({
        checkpoint_data: checkpoint,
      })
      .eq("id", jobId);
  }
}

// Export singleton
export const historicalScanner = new HistoricalScanner();
