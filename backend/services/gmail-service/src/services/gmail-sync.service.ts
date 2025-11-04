import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { gmailClient } from "../gmail-client";
import { emailFetcher } from "../email-fetcher";
import { TransactionExtractor } from "../transaction-extractor";
import { logger } from "../utils/logger";

dotenv.config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Gmail Sync Service - Orchestrates manual Gmail sync
 * Fetches emails since last sync, extracts transactions, and stores them
 */
export interface SyncResult {
  emailsScanned: number;
  transactionEmailsFound: number;
  newTransactions: number;
  duplicatesSkipped: number;
}

/**
 * Bank email patterns for filtering transaction emails
 */
const BANK_EMAIL_PATTERNS = [
  "alerts@hdfcbank.com",
  "alert@icicibank.com",
  "sbi.cards@sbi.co.in",
  "alerts.cards@axisbank.com",
  "creditcards@sc.com",
];

/**
 * Map email addresses to bank codes
 */
const EMAIL_TO_BANK_CODE: Record<string, string> = {
  "alerts@hdfcbank.com": "HDFC",
  "alert@icicibank.com": "ICICI",
  "sbi.cards@sbi.co.in": "SBI",
  "alerts.cards@axisbank.com": "AXIS",
  "creditcards@sc.com": "SC",
};

export class GmailSyncService {
  private transactionExtractor: TransactionExtractor;

  constructor() {
    this.transactionExtractor = new TransactionExtractor();
  }

  /**
   * Sync transactions from Gmail for a user
   * @param userId - User ID
   * @param since - Date to sync from (null for first sync)
   * @returns Sync result summary
   */
  async syncTransactions(
    userId: string,
    since: Date | null
  ): Promise<SyncResult> {
    const result: SyncResult = {
      emailsScanned: 0,
      transactionEmailsFound: 0,
      newTransactions: 0,
      duplicatesSkipped: 0,
    };

    try {
      logger.info({ userId, since }, "Starting Gmail sync");

      // Initialize Gmail client for user
      const gmail = await gmailClient.initializeForUser(userId);

      // Fetch emails since last sync
      const emails = await this.fetchEmailsSince(gmail, since);
      result.emailsScanned = emails.length;

      logger.info(
        { userId, emailCount: emails.length },
        "Fetched emails from Gmail"
      );

      // Process each email
      for (const email of emails) {
        try {
          // Check if email is from a bank
          const from = email.from.toLowerCase();
          const bankCode = this.identifyBank(from);

          if (!bankCode) {
            continue; // Skip non-bank emails
          }

          result.transactionEmailsFound++;

          // Extract transaction from email
          const emailData = {
            id: email.id,
            headers: {
              from: email.from,
              to: email.to.join(", "),
              subject: email.subject,
              date: email.date.toISOString(),
            },
            body: {
              text: email.bodyPlain,
              html: email.bodyHtml,
            },
            snippet: email.snippet,
          };

          const extractionResult = this.transactionExtractor.extract(
            emailData,
            bankCode
          );

          if (!extractionResult.success || !extractionResult.transaction) {
            logger.warn(
              { emailId: email.id, errors: extractionResult.errors },
              "Failed to extract transaction"
            );
            continue;
          }

          // Check for duplicate using email message ID
          const isDuplicate = await this.checkDuplicate(userId, email.id);

          if (isDuplicate) {
            result.duplicatesSkipped++;
            continue;
          }

          // Get user's credit cards to match card
          const card = await this.matchCard(
            userId,
            extractionResult.transaction.cardLastFour
          );

          if (!card) {
            logger.warn(
              {
                userId,
                cardLastFour: extractionResult.transaction.cardLastFour,
              },
              "No matching card found for transaction"
            );
            continue;
          }

          // Store transaction in database
          await this.storeTransaction(
            userId,
            card.id,
            extractionResult.transaction,
            email.id
          );

          result.newTransactions++;

          logger.info(
            {
              userId,
              emailId: email.id,
              merchant: extractionResult.transaction.merchant,
              amount: extractionResult.transaction.amount,
            },
            "Transaction extracted and stored"
          );
        } catch (error) {
          logger.error(
            { error, emailId: email.id },
            "Error processing email"
          );
        }
      }

      logger.info({ userId, result }, "Gmail sync completed");

      return result;
    } catch (error) {
      logger.error({ error, userId }, "Gmail sync failed");
      throw error;
    }
  }

  /**
   * Fetch emails since a specific date
   * @param gmail - Gmail API client
   * @param since - Date to fetch from (null for all)
   * @returns Array of normalized emails
   */
  private async fetchEmailsSince(
    gmail: any,
    since: Date | null
  ): Promise<any[]> {
    // Build query
    const sinceDate = since
      ? since.toISOString().split("T")[0]
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]; // Default: last 90 days

    const fromQuery = BANK_EMAIL_PATTERNS.map((email) => `from:${email}`).join(
      " OR "
    );
    const query = `after:${sinceDate} (${fromQuery})`;

    logger.info({ query }, "Fetching emails with query");

    // List message IDs
    const messageIds = await emailFetcher.listMessages(gmail, query, 100);

    // Fetch full messages in batch
    const emails = await emailFetcher.fetchEmailsBatch(gmail, messageIds);

    return emails;
  }

  /**
   * Identify bank from email address
   * @param from - Email from address
   * @returns Bank code or null
   */
  private identifyBank(from: string): string | null {
    for (const [email, bankCode] of Object.entries(EMAIL_TO_BANK_CODE)) {
      if (from.includes(email.toLowerCase())) {
        return bankCode;
      }
    }
    return null;
  }

  /**
   * Check if transaction already exists (deduplication)
   * @param userId - User ID
   * @param emailMessageId - Gmail message ID
   * @returns True if duplicate
   */
  private async checkDuplicate(
    userId: string,
    emailMessageId: string
  ): Promise<boolean> {
    const { data } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("email_message_id", emailMessageId)
      .limit(1);

    return !!(data && data.length > 0);
  }

  /**
   * Match transaction to user's credit card
   * @param userId - User ID
   * @param cardLastFour - Last 4 digits of card
   * @returns Matched card or null
   */
  private async matchCard(
    userId: string,
    cardLastFour: string | null
  ): Promise<any> {
    if (!cardLastFour) {
      // If no card number in email, return first active card
      const { data } = await supabase
        .from("credit_cards")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1);

      return data && data.length > 0 ? data[0] : null;
    }

    // Try to match by last 4 digits
    const { data } = await supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!data || data.length === 0) {
      return null;
    }

    // Match card by last 4 digits
    const matchedCard = data.find((card: any) =>
      card.card_number?.endsWith(cardLastFour)
    );

    return matchedCard || data[0]; // Fallback to first card
  }

  /**
   * Store extracted transaction in database
   * @param userId - User ID
   * @param cardId - Credit card ID
   * @param transaction - Extracted transaction
   * @param emailMessageId - Gmail message ID
   */
  private async storeTransaction(
    userId: string,
    cardId: string,
    transaction: any,
    emailMessageId: string
  ): Promise<void> {
    const billingMonth = transaction.date.getMonth() + 1;
    const billingYear = transaction.date.getFullYear();

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      card_id: cardId,
      amount: transaction.amount,
      currency: transaction.currency || "INR",
      merchant_name: transaction.merchant,
      category: transaction.category || "other",
      transaction_type: transaction.transactionType || "debit",
      transaction_date: transaction.date.toISOString(),
      billing_cycle_month: billingMonth,
      billing_cycle_year: billingYear,
      email_message_id: emailMessageId,
      extraction_confidence: transaction.confidence,
      extraction_method: transaction.extractionMethod,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      logger.error({ error }, "Failed to store transaction");
      throw error;
    }
  }
}

// Export singleton
export const gmailSyncService = new GmailSyncService();
