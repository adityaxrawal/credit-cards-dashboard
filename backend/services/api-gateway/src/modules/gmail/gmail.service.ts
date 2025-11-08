import { gmailClient } from "./gmail-client";
import { emailFetcher } from "./email-fetcher";
import { transactionExtractor } from "./transaction-extractor";
import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";
import rateLimit from "express-rate-limit";
import {
  GmailSyncError,
  GmailSyncResult,
  categorizeGmailError,
  logSyncOperation,
  validateGmailConnection,
} from "shared/lib/gmail/syncService";

// Specialized rate limiter for Gmail endpoints (configured in controller mount if needed)
export const gmailRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GMAIL_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
});

class GmailService {
  getAuthUrl(): string {
    return gmailClient.getAuthUrl();
  }

  async handleCallback(userId: string, code: string): Promise<void> {
    try {
      // Exchange authorization code for tokens
      const tokens = await gmailClient.exchangeCodeForTokens(code);

      // Store tokens for user
      await gmailClient.storeUserTokens(userId, tokens);

      logger.info("Gmail tokens stored successfully", { userId });
    } catch (error) {
      logger.error("Error handling Gmail callback", error as Error);
      throw new Error("Failed to complete Gmail authorization");
    }
  }

  async getStatus(userId: string) {
    const connected = await gmailClient.isConnected(userId);
    const { data: user } = await supabase
      .from("users")
      .select("gmail_history_id, gmail_last_sync")
      .eq("id", userId)
      .single();
    return {
      connected,
      historyId: user?.gmail_history_id || null,
      lastSync: user?.gmail_last_sync || null,
    };
  }

  async revoke(userId: string) {
    await gmailClient.disconnect(userId);
  }

  /**
   * Sync inbox: fetch recent transaction-related emails, extract transactions, persist.
   * Uses structured error handling and logging
   */
  async syncUserInbox(userId: string): Promise<GmailSyncResult> {
    try {
      // Validate Gmail is connected
      await validateGmailConnection(userId, () => gmailClient.isConnected(userId));

      logSyncOperation("fetch_messages_start", userId, {});

      // Basic heuristic query - can be refined per bank patterns
      const searchQuery = "(subject:(transaction OR spent OR purchase) OR 'debited' OR 'credited')";

      let gmail;
      try {
        gmail = await gmailClient.initializeForUser(userId);
      } catch (error) {
        throw categorizeGmailError(error);
      }

      let messageIds;
      try {
        messageIds = await emailFetcher.listMessages(gmail, searchQuery, 50);
      } catch (error) {
        throw categorizeGmailError(error);
      }

      logSyncOperation("fetch_messages_complete", userId, {
        count: messageIds.length,
      });

      let emails;
      try {
        emails = await emailFetcher.fetchEmailsBatch(gmail, messageIds);
      } catch (error) {
        throw categorizeGmailError(error);
      }

      let inserted = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails: Array<{
        code: string;
        message: string;
        emailId?: string;
      }> = [];

      for (const email of emails) {
        try {
          // Dedup by message id
          const { data: existingTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("email_message_id", email.id)
            .eq("user_id", userId)
            .limit(1);
          if (existingTx && existingTx.length > 0) {
            skipped++;
            continue;
          }

          // Attempt extraction (bankCode heuristic from sender domain)
          const fromDomain = email.from.split("@")[1] || "generic";
          const bankCode = fromDomain.split(".")[0];
          const extraction = transactionExtractor.extract(
            {
              id: email.id,
              headers: {
                from: email.from,
                to: email.to.join(","),
                subject: email.subject,
                date: email.date.toISOString(),
              },
              body: { text: email.bodyPlain, html: email.bodyHtml },
              snippet: email.snippet,
            },
            bankCode
          );

          if (!extraction.success || !extraction.transaction) {
            skipped++;
            continue;
          }

          const tx = extraction.transaction;

          // Find matching card by last four if available
          let cardId: string | undefined;
          if (tx.cardLastFour) {
            const { data: cardMatch } = await supabase
              .from("credit_cards")
              .select("id, bill_date")
              .eq("user_id", userId)
              .eq("last_four_digits", tx.cardLastFour)
              .limit(1);
            if (cardMatch && cardMatch.length > 0) {
              cardId = cardMatch[0].id;
            }
          }

          // Billing cycle calculation if card found
          let billing_cycle_month: number | undefined;
          let billing_cycle_year: number | undefined;
          if (cardId) {
            const { data: card } = await supabase
              .from("credit_cards")
              .select("bill_date")
              .eq("id", cardId)
              .single();
            if (card?.bill_date) {
              const dateObj = new Date(tx.date);
              const billDay = card.bill_date;
              const month = dateObj.getMonth() + 1;
              const year = dateObj.getFullYear();
              // naive: if date past bill date treat as next cycle else current
              billing_cycle_month = month;
              billing_cycle_year = year;
              if (dateObj.getDate() > billDay) {
                billing_cycle_month = (month % 12) + 1;
                if (month === 12) billing_cycle_year = year + 1;
              }
            }
          }

          const { error: insertError } = await supabase.from("transactions").insert({
            user_id: userId,
            card_id: cardId || null,
            transaction_date: tx.date.toISOString(),
            merchant_name: tx.merchant,
            merchant_category: tx.category,
            amount: tx.amount,
            transaction_type: tx.transactionType,
            description: tx.rawText.substring(0, 250),
            email_message_id: email.id,
            is_manually_added: false,
            billing_cycle_month,
            billing_cycle_year,
            metadata: {
              extraction_confidence: tx.confidence,
              extraction_method: tx.extractionMethod,
              bank_code: bankCode,
            },
          });

          if (insertError) {
            errors++;
            const errorDetail = {
              code: "TRANSACTION_INSERT_FAILED",
              message: `Failed inserting transaction: ${insertError.message}`,
              emailId: email.id,
            };
            errorDetails.push(errorDetail);
            logger.error(errorDetail.message, insertError, { userId, emailId: email.id });
          } else {
            inserted++;
          }

          // Log email processed
          await supabase.from("email_processing_log").insert({
            user_id: userId,
            email_message_id: email.id,
            processing_status: insertError ? "error" : "processed",
            error_message: insertError?.message || null,
          });
        } catch (err) {
          errors++;
          const errorDetail = {
            code: "EMAIL_PROCESSING_ERROR",
            message: `Email processing failure: ${(err as Error).message}`,
            emailId: email.id,
          };
          errorDetails.push(errorDetail);
          logger.error(errorDetail.message, err as Error, { userId, emailId: email.id });
        }
      }

      // Update user last sync timestamp
      try {
        await supabase
          .from("users")
          .update({ gmail_last_sync: new Date().toISOString() })
          .eq("id", userId);
      } catch (error) {
        logger.error("Failed to update last sync timestamp", error as Error, { userId });
        // Non-critical, don't fail the sync
      }

      logSyncOperation("sync_summary", userId, {
        processed: emails.length,
        inserted,
        skipped,
        errors,
      });

      return {
        success: true,
        processed: emails.length,
        inserted,
        skipped,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      };
    } catch (error) {
      // Re-throw structured errors
      if (error instanceof GmailSyncError) {
        throw error;
      }
      // Categorize unknown errors
      throw categorizeGmailError(error);
    }
  }
}

export const gmailService = new GmailService();
