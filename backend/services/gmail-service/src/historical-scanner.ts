import { gmailClient } from "./gmail-client";
import { emailQueue } from "./email-queue";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export interface ScanJob {
  jobId: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalEmails: number;
  processedEmails: number;
  extractedTransactions: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export interface ScanProgress {
  jobId: string;
  status: string;
  progress: number; // 0-100
  totalEmails: number;
  processedEmails: number;
  extractedTransactions: number;
  estimatedTimeRemaining: string;
}

/**
 * Historical email scanner
 */
export class HistoricalScanner {
  /**
   * Start historical scan for user
   */
  async startScan(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ jobId: string; totalEmails: number }> {
    try {
      // Generate job ID
      const jobId = `scan-${userId}-${Date.now()}`;

      // Create job record
      await supabase.from("scan_jobs").insert({
        job_id: jobId,
        user_id: userId,
        status: "pending",
        total_emails: 0,
        processed_emails: 0,
        extracted_transactions: 0,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Start scan in background
      this.processScan(jobId, userId, startDate, endDate).catch((error) => {
        console.error(`Error processing scan job ${jobId}:`, error);
        this.updateJobStatus(jobId, "failed", error.message);
      });

      // Estimate total emails (this is approximate)
      const totalEmails = await this.estimateEmailCount(userId, startDate, endDate);

      return { jobId, totalEmails };
    } catch (error) {
      console.error("Error starting historical scan:", error);
      throw error;
    }
  }

  /**
   * Process scan job
   */
  private async processScan(
    jobId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Update status to running
      await this.updateJobStatus(jobId, "running");

      // Fetch emails in batches (1 month at a time)
      const monthRanges = this.generateMonthRanges(startDate, endDate);
      let totalProcessed = 0;
      let totalExtracted = 0;

      for (const { start, end } of monthRanges) {
        console.log(`Scanning emails from ${start.toISOString()} to ${end.toISOString()}`);

        // Fetch messages for this month
        const messages = await this.fetchMessagesInRange(userId, start, end);

        console.log(`Found ${messages.length} messages in range`);

        // Queue messages for processing
        if (messages.length > 0) {
          await emailQueue.addFetchEmailJobs(userId, messages);
          totalProcessed += messages.length;
        }

        // Update progress
        await this.updateJobProgress(jobId, totalProcessed, 0);

        // Add delay to respect rate limits (250 quota units/user/second)
        // Each list call = 5 units, so max 50 calls/second
        // We're being conservative with 1 call every 100ms
        await this.sleep(100);
      }

      // Update job completion
      await this.updateJobStatus(jobId, "completed");
      await supabase
        .from("scan_jobs")
        .update({
          completed_at: new Date().toISOString(),
          total_emails: totalProcessed,
        })
        .eq("job_id", jobId);

      console.log(`Historical scan ${jobId} completed: ${totalProcessed} emails processed`);
    } catch (error) {
      console.error(`Error in processScan for job ${jobId}:`, error);
      await this.updateJobStatus(jobId, "failed", error instanceof Error ? error.message : "Unknown error");
      throw error;
    }
  }

  /**
   * Fetch messages in date range
   */
  private async fetchMessagesInRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string[]> {
    try {
      const result = await gmailClient.listMessages(userId, {
        query: "from:(*bank* OR *card*)",
        maxResults: 500,
        after: startDate,
        before: endDate,
      });

      return result.messages?.map((m) => m.id!) || [];
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  }

  /**
   * Estimate email count for date range
   */
  private async estimateEmailCount(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const result = await gmailClient.listMessages(userId, {
        query: "from:(*bank* OR *card*)",
        maxResults: 1,
        after: startDate,
        before: endDate,
      });

      return result.resultSizeEstimate || 0;
    } catch (error) {
      console.error("Error estimating email count:", error);
      return 0;
    }
  }

  /**
   * Generate month ranges for scanning
   */
  private generateMonthRanges(startDate: Date, endDate: Date): Array<{ start: Date; end: Date }> {
    const ranges: Array<{ start: Date; end: Date }> = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const rangeStart = new Date(current);
      const rangeEnd = new Date(current);
      rangeEnd.setMonth(rangeEnd.getMonth() + 1);

      // Don't exceed end date
      if (rangeEnd > endDate) {
        rangeEnd.setTime(endDate.getTime());
      }

      ranges.push({ start: rangeStart, end: rangeEnd });

      current.setMonth(current.getMonth() + 1);
    }

    return ranges;
  }

  /**
   * Get scan job status
   */
  async getJobStatus(jobId: string): Promise<ScanProgress | null> {
    try {
      const { data, error } = await supabase
        .from("scan_jobs")
        .select("*")
        .eq("job_id", jobId)
        .single();

      if (error || !data) {
        return null;
      }

      const progress = data.total_emails > 0 ? (data.processed_emails / data.total_emails) * 100 : 0;

      // Estimate time remaining
      const elapsedMs = new Date().getTime() - new Date(data.created_at).getTime();
      const emailsPerMs = data.processed_emails / elapsedMs;
      const remainingEmails = data.total_emails - data.processed_emails;
      const remainingMs = remainingEmails / emailsPerMs;

      let estimatedTimeRemaining = "Unknown";
      if (data.status === "running" && !isNaN(remainingMs) && remainingMs > 0) {
        const minutes = Math.ceil(remainingMs / 60000);
        estimatedTimeRemaining = minutes > 60 ? `~${Math.ceil(minutes / 60)} hours` : `~${minutes} minutes`;
      } else if (data.status === "completed") {
        estimatedTimeRemaining = "Completed";
      }

      return {
        jobId: data.job_id,
        status: data.status,
        progress: Math.round(progress),
        totalEmails: data.total_emails,
        processedEmails: data.processed_emails,
        extractedTransactions: data.extracted_transactions,
        estimatedTimeRemaining,
      };
    } catch (error) {
      console.error("Error getting job status:", error);
      return null;
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string, error?: string): Promise<void> {
    await supabase
      .from("scan_jobs")
      .update({
        status,
        error: error || null,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId);
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(
    jobId: string,
    processedEmails: number,
    extractedTransactions: number
  ): Promise<void> {
    await supabase
      .from("scan_jobs")
      .update({
        processed_emails: processedEmails,
        extracted_transactions: extractedTransactions,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const historicalScanner = new HistoricalScanner();
