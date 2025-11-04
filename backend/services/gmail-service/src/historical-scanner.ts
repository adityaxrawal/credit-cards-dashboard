import { gmailSyncService } from "./services/gmail-sync.service";

export interface ScanJob {
  jobId: string;
  userId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalEmails: number;
  extractedTransactions: number;
  message: string;
}

/**
 * Historical email scanner (Zero-Cost Architecture)
 * Uses GmailSyncService directly instead of background queue
 */
export class HistoricalScanner {
  /**
   * Start historical scan for user
   * In zero-cost architecture, this runs synchronously using GmailSyncService
   * 
   * @param userId - User ID
   * @param startDate - Start date for scan
   * @param endDate - End date for scan (note: actual sync goes from startDate to now)
   */
  async startScan(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScanJob> {
    try {
      const jobId = `scan-${userId}-${Date.now()}`;

      console.log(
        `Starting historical scan ${jobId} from ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Use GmailSyncService directly (no background worker needed)
      const result = await gmailSyncService.syncTransactions(userId, startDate);

      console.log(
        `Historical scan ${jobId} completed: ${result.newTransactions} transactions extracted`
      );

      return {
        jobId,
        userId,
        status: "completed",
        totalEmails: result.emailsScanned,
        extractedTransactions: result.newTransactions,
        message: `Scanned ${result.emailsScanned} emails, extracted ${result.newTransactions} transactions (${result.duplicatesSkipped} duplicates skipped)`,
      };
    } catch (error) {
      console.error("Error in historical scan:", error);
      
      return {
        jobId: `scan-${userId}-${Date.now()}`,
        userId,
        status: "failed",
        totalEmails: 0,
        extractedTransactions: 0,
        message: error instanceof Error ? error.message : "Scan failed",
      };
    }
  }

  /**
   * Get job status (simplified for zero-cost architecture)
   * Since scans complete synchronously, this always returns completed status
   * 
   * @param jobId - Job ID
   */
  async getJobStatus(jobId: string): Promise<ScanJob | null> {
    // In zero-cost architecture, scans complete immediately
    // No background job tracking needed
    console.log(`Job status requested for ${jobId} - scans complete synchronously`);
    
    return {
      jobId,
      userId: "unknown",
      status: "completed",
      totalEmails: 0,
      extractedTransactions: 0,
      message: "Historical scans complete synchronously in zero-cost architecture",
    };
  }
}

export const historicalScanner = new HistoricalScanner();
