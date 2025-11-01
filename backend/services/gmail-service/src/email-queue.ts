import Queue, { Job, Queue as QueueType } from "bull";
import Redis from "ioredis";
import { gmailClient } from "./gmail-client";

// Redis client configuration
const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Queue configuration
const QUEUE_NAME = "email-processing";

/**
 * Email processing queue using Bull
 */
export class EmailQueue {
  private queue: QueueType;

  constructor() {
    this.queue = new Queue(QUEUE_NAME, {
      redis: process.env.REDIS_URL || "redis://localhost:6379",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs
      },
    });

    this.setupProcessors();
    this.setupEventListeners();
  }

  /**
   * Setup job processors
   */
  private setupProcessors(): void {
    // Fetch email job processor
    this.queue.process("fetch-email", 5, this.processFetchEmail.bind(this));

    // Classify email job processor
    this.queue.process("classify-email", 10, this.processClassifyEmail.bind(this));

    // Extract transaction job processor
    this.queue.process("extract-transaction", 5, this.processExtractTransaction.bind(this));
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    this.queue.on("completed", (job: Job) => {
      console.log(`Job ${job.id} (${job.name}) completed successfully`);
    });

    this.queue.on("failed", (job: Job, err: Error) => {
      console.error(`Job ${job.id} (${job.name}) failed:`, err.message);
    });

    this.queue.on("stalled", (job: Job) => {
      console.warn(`Job ${job.id} (${job.name}) stalled`);
    });

    this.queue.on("error", (error: Error) => {
      console.error("Queue error:", error);
    });
  }

  /**
   * Add fetch-email job to queue
   */
  async addFetchEmailJob(userId: string, messageId: string): Promise<Job> {
    return this.queue.add("fetch-email", {
      userId,
      messageId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add multiple fetch-email jobs in bulk
   */
  async addFetchEmailJobs(userId: string, messageIds: string[]): Promise<Job[]> {
    const jobs = messageIds.map((messageId) => ({
      name: "fetch-email",
      data: {
        userId,
        messageId,
        timestamp: new Date().toISOString(),
      },
    }));

    return this.queue.addBulk(jobs);
  }

  /**
   * Add classify-email job to queue
   */
  async addClassifyEmailJob(userId: string, messageId: string, emailData: any): Promise<Job> {
    return this.queue.add("classify-email", {
      userId,
      messageId,
      emailData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add extract-transaction job to queue
   */
  async addExtractTransactionJob(
    userId: string,
    messageId: string,
    emailData: any,
    classificationResult: any
  ): Promise<Job> {
    return this.queue.add("extract-transaction", {
      userId,
      messageId,
      emailData,
      classificationResult,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Process fetch-email job
   */
  private async processFetchEmail(job: Job): Promise<any> {
    const { userId, messageId } = job.data;

    try {
      console.log(`Fetching email for user ${userId}, message ${messageId}`);

      // Fetch message from Gmail
      const message = await gmailClient.getMessage(userId, messageId);

      // Extract headers and body
      const headers = gmailClient.extractHeaders(message);
      const body = gmailClient.extractMessageBody(message);

      const emailData = {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        internalDate: message.internalDate,
        headers,
        body,
      };

      // Queue for classification
      await this.addClassifyEmailJob(userId, messageId, emailData);

      return {
        success: true,
        messageId,
        emailData,
      };
    } catch (error) {
      console.error(`Error fetching email ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Process classify-email job
   */
  private async processClassifyEmail(job: Job): Promise<any> {
    const { userId, messageId, emailData } = job.data;

    try {
      console.log(`Classifying email for user ${userId}, message ${messageId}`);

      // Import classifier
      const { emailClassifier } = await import("./email-classifier");

      // Classify email
      const classificationResult = emailClassifier.classify(emailData);

      console.log(`Classification result for ${messageId}:`, {
        isTransaction: classificationResult.isTransaction,
        confidence: classificationResult.confidence,
        bankName: classificationResult.bankName,
        category: classificationResult.category,
      });

      // If classified as transaction with sufficient confidence, queue for extraction
      if (classificationResult.isTransaction && classificationResult.confidence > 0.5) {
        await this.addExtractTransactionJob(userId, messageId, emailData, classificationResult);
      }

      return {
        success: true,
        messageId,
        classificationResult,
      };
    } catch (error) {
      console.error(`Error classifying email ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Process extract-transaction job
   */
  private async processExtractTransaction(job: Job): Promise<any> {
    const { userId, messageId, emailData, classificationResult } = job.data;

    try {
      console.log(`Extracting transaction for user ${userId}, message ${messageId}`);

      // Import transaction extractor
      const { transactionExtractor } = await import("./transaction-extractor");

      // Extract transaction using bank-specific patterns
      const bankCode = classificationResult.bankCode || "hdfc"; // Default to HDFC
      const extractionResult = transactionExtractor.extract(emailData, bankCode);

      console.log(`Extraction result for ${messageId}:`, {
        success: extractionResult.success,
        confidence: extractionResult.confidence,
        method: extractionResult.method,
        amount: extractionResult.transaction?.amount,
        merchant: extractionResult.transaction?.merchant,
      });

      // TODO: Save transaction to database if confidence is high enough
      // if (extractionResult.success && extractionResult.confidence > 0.7) {
      //   await saveTransaction(userId, extractionResult.transaction);
      // }

      return {
        success: true,
        messageId,
        extractionResult,
      };
    } catch (error) {
      console.error(`Error extracting transaction from email ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get queue instance (for advanced operations)
   */
  getQueue(): QueueType {
    return this.queue;
  }

  /**
   * Close queue connections
   */
  async close(): Promise<void> {
    await this.queue.close();
    await redisClient.quit();
  }
}

// Export singleton instance
export const emailQueue = new EmailQueue();
