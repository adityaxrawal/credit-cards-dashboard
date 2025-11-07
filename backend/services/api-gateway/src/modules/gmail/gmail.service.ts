import { gmailClient } from "./gmail-client";
import { emailFetcher } from "./email-fetcher";
import { transactionExtractor } from "./transaction-extractor";
import { supabase } from "shared/database/supabase";
import { logger } from "shared/monitoring/logger";
import rateLimit from "express-rate-limit";

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
   */
  async syncUserInbox(userId: string): Promise<{
    processed: number;
    inserted: number;
    skipped: number;
    errors: number;
  }> {
    // Basic heuristic query - can be refined per bank patterns
    const searchQuery = "(subject:(transaction OR spent OR purchase) OR 'debited' OR 'credited')";
    const gmail = await gmailClient.initializeForUser(userId);
    const messageIds = await emailFetcher.listMessages(gmail, searchQuery, 50);
    logger.info("Gmail messages fetched", { userId, count: messageIds.length });

    const emails = await emailFetcher.fetchEmailsBatch(gmail, messageIds);
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

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
          logger.error(`Failed inserting transaction: ${insertError.message}`);
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
        logger.error(`Email processing failure: ${(err as Error).message}`);
      }
    }

    // Update user last sync timestamp
    await supabase
      .from("users")
      .update({ gmail_last_sync: new Date().toISOString() })
      .eq("id", userId);

    return { processed: emails.length, inserted, skipped, errors };
  }
}

export const gmailService = new GmailService();
