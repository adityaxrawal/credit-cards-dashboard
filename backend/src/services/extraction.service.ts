import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import * as cardsQueries from '../db/queries/cards.queries';
import * as transactionsQueries from '../db/queries/transactions.queries';
import { BankParsers, ParsedTransaction } from './extraction/bankParsers';
import { PdfParser } from './extraction/pdfParser';
import { GmailLinkGenerator } from '../utils/gmailLinkGenerator';
import { BankParserPatterns } from '../utils/regexCache';
import { MerchantExtractor } from '../utils/merchantExtractor';
import { DateParser } from './extraction/dateParser';
import pool from '../lib/db'; // Import DB pool for logging
import { CreditCardMailDetector } from './creditCardMailDetector';

/**
 * Utility to clean email body before regex matching
 * Normalizes HTML artifacts, whitespace, and special characters
 */
function cleanBody(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')           // HTML non-breaking space entities
    .replace(/&amp;/gi, '&')            // HTML ampersand entities
    .replace(/&lt;/gi, '<')             // HTML less-than entities
    .replace(/&gt;/gi, '>')             // HTML greater-than entities
    .replace(/&#\d+;/g, ' ')            // Numeric HTML entities
    .replace(/\u00a0/g, ' ')            // Unicode non-breaking spaces
    .replace(/\r\n/g, ' ')              // Windows newlines
    .replace(/[\r\n]+/g, ' ')           // Unix newlines
    .replace(/\t+/g, ' ')               // Tabs
    .replace(/\s{2,}/g, ' ')            // Multiple spaces to single
    .trim();
}

export interface ExtractionInput {
  id: string;
  subject: string;
  from: string;
  bodyText: string;
  bodyHtml?: string;
  date: Date;
  threadId?: string;
  attachments?: { id: string; filename: string; mimeType: string }[];
}

export type AttachmentFetcher = (messageId: string, attachmentId: string) => Promise<Buffer | null>;

export interface ExtractionResult {
  status: 'success' | 'error' | 'unknown_format' | 'queued_for_gpt' | 'details_needed' | 'duplicate' | 'already_processed' | 'ignored';
  transaction?: {
    amount: number;
    transactionDate: Date;
    merchant: string;
    bankName: string;
    lastFourDigits: string;
    category: string;
    exactTimestamp?: Date;
    transactionType?: string;
    currencyCode?: string;
    originalAmount?: number;
    referenceNumber?: string;
    emailSubject?: string;
    gmailMessageId?: string;
    gmailThreadId?: string;
    gmailLink?: string;
    gmailThreadLink?: string;
  };
  error?: string;
  reason?: string;
  processedCount?: number;
}

/**
 * Extract transaction from email
 */
export async function extractTransactionFromEmail(
  userId: string,
  message: ExtractionInput,
  fetchAttachment?: AttachmentFetcher
): Promise<ExtractionResult> {
  try {
    // ✅ NEW: Check if already processed
    const existing = await pool.query(
      `SELECT processing_status FROM email_processing_log 
       WHERE user_id = $1 AND email_message_id = $2 LIMIT 1`,
      [userId, message.id]
    );

    if (existing.rows.length > 0) {
      const status = existing.rows[0].processing_status;
      if (['gpt_processed', 'success', 'ignored'].includes(status)) {
        console.log(`[ExtractionService] Email ${message.id} already processed (status=${status}), skipping.`);
        return { status: 'already_processed', reason: `Already processed: ${status}` };
      }
    }

    // 1. Guard Clause: Check if should process
    // Convert ExtractionInput to SimplifiedEmail structure for detector
    const simplifiedEmailForDetect = {
      messageId: message.id,
      threadId: message.threadId || '',
      from: message.from,
      subject: message.subject,
      body: message.bodyText,
      internalDate: message.date.getTime(),
      to: ''
    };

    // Use the robust detector
    const detection = CreditCardMailDetector.detect(simplifiedEmailForDetect);

    if (!detection.shouldProcess) {
      // Log skipped
      try {
        await pool.query(
          `INSERT INTO email_processing_log 
             (user_id, email_message_id, from_email, subject, processing_status, reason, error_message, processed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (email_message_id) 
             DO UPDATE SET processing_status = $5, reason = $6, error_message = $7`,
          [userId, message.id, message.from, message.subject, 'skipped', detection.reason, `Detector rejected: ${detection.reason} (${detection.category})`, 'rule_based']
        );
      } catch (e) { }

      return { status: 'ignored', reason: detection.reason, error: detection.reason };
    }

    // 2. Identify Bank Parser
    const parser = BankParsers.find(p =>
      p.identifiers.some(id =>
        message.from.toLowerCase().includes(id) ||
        message.subject.toLowerCase().includes(id)
      )
    );

    if (!parser) {
      console.log(`[ExtractionService] No parser found for: ${message.subject} from ${message.from}`);

      // Log as potentialGPT candidate or failure
      await pool.query(
        `INSERT INTO email_processing_log 
         (user_id, email_message_id, from_email, subject, processing_status, reason, error_message, processed_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (email_message_id) 
         DO UPDATE SET processing_status = $5, reason = $6, error_message = $7`,
        [userId, message.id, message.from, message.subject, 'rule_based_attempt', 'No matching bank parser', 'No matching bank parser found', 'rule_based']
      );

      return { status: 'queued_for_gpt', reason: 'No matching bank parser found', error: 'No matching bank parser found' };
    }

    // 2. Prepare Text Content
    let textToParse = message.bodyText;

    // Optimized HTML processing: Use fast regex for simple cases
    if ((!textToParse || textToParse.length < 50) && message.bodyHtml) {
      const html = message.bodyHtml;

      // Check if HTML contains scripts or styles (indicates complex HTML)
      const hasComplexHtml = /<script|<style/i.test(html);

      if (hasComplexHtml) {
        // Use Cheerio for complex HTML
        const $ = cheerio.load(html);
        $('script').remove();
        $('style').remove();
        // Convert boundaries to newlines
        $('br').replaceWith('\n');
        $('p').after('\n');
        textToParse = $('body').text();
      } else {
        // Use fast regex for simple HTML (10x faster)
        // Converts <br> and <p> boundaries into newline \n, then strips tags, then collapses whitespace
        textToParse = html.replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    // Clean text - apply cleanBody first for HTML normalization, then PdfParser.cleanText
    textToParse = cleanBody(textToParse);
    textToParse = PdfParser.cleanText(textToParse);

    // 3. Try Parsing Body (Single Transaction)
    // Only parse body if it's NOT a Statement email (statements require PDF parsing usually)
    const isStatement = /statement/i.test(message.subject);
    let parsed: ParsedTransaction | null = null;

    if (!isStatement) {
      parsed = parser.parse(textToParse, message.subject, message.from, message.date);
    }

    // Debug logging for rule-based extraction
    if (parsed) {
      console.log(`[RuleBased] Success - Extracted:`, {
        amount: parsed.amount,
        merchant: parsed.merchant,
        date: parsed.transactionDate?.toISOString().split('T')[0],
        confidence: 'high',
        bank: parsed.bankName
      });
    } else if (!isStatement) {
      console.log(`[RuleBased] Failed - No match for ${parser.name} parser on: ${message.subject.substring(0, 50)}`);
    }

    // Fallback for merchant extraction
    if (parsed && (!parsed.merchant || parsed.merchant.trim().length === 0 || parsed.merchant.trim().split(/\s+/).length <= 1)) {
      const fallback = MerchantExtractor.extract(textToParse);
      if (fallback) {
        parsed.merchant = fallback;
      }
    }

    // 4. Handle Attachments (PDFs)
    let processedCount = 0;

    if (message.attachments && message.attachments.length > 0 && fetchAttachment) {
      console.log(`[ExtractionService] Checking ${message.attachments.length} attachments...`);

      for (const att of message.attachments) {
        if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          const buffer = await fetchAttachment(message.id, att.id);
          if (buffer) {
            const pdfText = await PdfParser.extractText(buffer);

            // Step 3: PDF Statement Extraction logic
            if (isStatement) {
              console.log(`[ExtractionService] Processing Statement PDF: ${att.filename}`);
              processedCount = await processPdfStatement(userId, pdfText, message, parser.bankName);
              if (processedCount > 0) {
                await pool.query(
                  `INSERT INTO email_processing_log 
                     (user_id, email_message_id, from_email, subject, processing_status, reason, extracted_amount, extracted_merchant, processed_by, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                     ON CONFLICT (email_message_id) 
                     DO UPDATE SET processing_status = $5, reason = $6`,
                  [userId, message.id, message.from, message.subject, 'success', `Statement processed: ${processedCount} txns`, 0, 'Bulk PDF', 'rule_based']
                );
                return { status: 'success', processedCount };
              }
            }

            // Regular PDF individual transaction parsing fallback
            if (!parsed) {
              const cleanPdfText = PdfParser.cleanText(pdfText);
              parsed = parser.parse(cleanPdfText, message.subject, message.from, message.date);

              // Fallback for merchant extraction in PDF
              if (parsed && (!parsed.merchant || parsed.merchant.trim().length === 0 || parsed.merchant.trim().split(/\s+/).length <= 1)) {
                const fallback = MerchantExtractor.extract(cleanPdfText);
                if (fallback) {
                  parsed.merchant = fallback;
                }
              }
              if (parsed) {
                console.log(`[ExtractionService] Successfully parsed PDF attachment: ${att.filename}`);
                break;
              }
            }
          }
        }
      }
    }

    if (!parsed) {
      if (processedCount > 0) {
        // Already logged statement success above
        return { status: 'success', processedCount };
      }

      // Log failed parse -> Queue for GPT
      try {
        await pool.query(
          `INSERT INTO email_processing_log 
             (user_id, email_message_id, from_email, subject, processing_status, reason, error_message, processed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (email_message_id) 
             DO UPDATE SET processing_status = $5, reason = $6, error_message = $7`,
          [userId, message.id, message.from, message.subject, 'rule_based_attempt', 'Content parsing failed', 'Failed to parse email content', 'rule_based']
        );
      } catch (e) { console.warn('Log error', e); }

      return { status: 'queued_for_gpt', error: 'Failed to parse email content and attachments', reason: 'Parsing failed' };
    }

    // Log success/processing attempt
    try {
      await pool.query(
        `INSERT INTO email_processing_log 
             (user_id, email_message_id, from_email, subject, processing_status, 
              extracted_amount, extracted_merchant, processed_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (email_message_id) 
             DO UPDATE SET processing_status = $5, extracted_amount = $6, extracted_merchant = $7`,
        [
          userId,
          message.id,
          message.from,
          message.subject,
          'success',
          parsed.amount,
          parsed.merchant,
          'rule_based'
        ]
      );
    } catch (logErr) {
      console.warn('[ExtractionService] Failed to log success:', logErr);
    }

    // 5. Return transaction data
    return {
      status: 'success',
      transaction: {
        amount: parsed.amount,
        transactionDate: parsed.transactionDate,
        merchant: parsed.merchant,
        bankName: parsed.bankName,
        lastFourDigits: parsed.lastFourDigits,
        category: parsed.category,
        exactTimestamp: parsed.exactTimestamp,
        transactionType: parsed.transactionType,
        currencyCode: parsed.currencyCode,
        originalAmount: parsed.originalAmount,
        referenceNumber: parsed.referenceNumber,
        emailSubject: message.subject,
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        gmailLink: GmailLinkGenerator.generateLink(message.id),
        gmailThreadLink: message.threadId ? GmailLinkGenerator.generateThreadLink(message.threadId) : undefined,
      },
    };

  } catch (error: any) {
    // ✅ NEW: Handle duplicate key constraint specifically
    if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
      console.warn(`[ExtractionService] Duplicate entry for email ${message.id}, skipping.`);
      return { status: 'duplicate', reason: 'Duplicate entry' };
    }

    console.error('[ExtractionService] Error extracting transaction:', error);

    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      reason: error.message
    };
  }
}

/**
 * Process PDF Statement content
 * Extracts rows, verifies/deduplicates, and inserts valid transactions
 */
async function processPdfStatement(
  userId: string,
  text: string,
  message: ExtractionInput,
  bankName: string
): Promise<number> {
  const lines = text.split(/\n/);
  let count = 0;

  // Generic Transaction Pattern: Date | Description | Amount | [Dr/Cr]
  // Matches: 12/01/2023  UBER TRIP  129.00  Dr
  const rowPattern = /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+([^\d]+?)\s+((?:Rs\.?|INR)?\s*[\d,]+\.\d{2})\s*(Dr|Cr|Debit|Credit)?/i;

  // Attempt to find a card number on the statement to link to
  // (Naive approach: just use the first card found for now, or require cardId link later)
  // For now we will insert without card_id (or link to a "Unknown" card if required, but schema requires card_id)
  // We need a card. Let's try to extract ANY card number from the text to use as context.
  let linkedCardId: string | null = null;
  const cardMatch = text.match(/(?:card|ending)[\s\S]{0,20}(\d{4})/i); // Loose search
  if (cardMatch) {
    const last4 = cardMatch[1];
    // Try to find the card
    // We need to import findOrCreateCard logic here or use queries directly.
    // To avoid circular dep with cards.service, we use queries.
    const card = await cardsQueries.findCardByLastFour(userId, last4);
    if (card) linkedCardId = card.id;
  }

  if (!linkedCardId) {
    // If no card specific logic found, we might fallback to a default or fail.
    // For this generic implementation, we'll skip insertion if no card logic.
    // However, the requirement is "Insert valid...".
    // We'll log warning.
    console.warn('[Extraction] Could not link statement to a specific card. Skipping insertion.');
    return 0;
  }

  for (const line of lines) {
    // Sanity checks
    if (!line || line.length < 10) continue;

    const match = line.match(rowPattern);
    if (match) {
      const [_, dateStr, desc, amountStr, type] = match;

      const amount = parseFloat(amountStr.replace(/[^0-9.]/g, ''));
      if (amount === 0 || isNaN(amount)) continue;

      const date = DateParser.parse(dateStr);
      if (!date || isNaN(date.getTime())) continue;

      const merchant = desc.trim();
      const isCredit = type?.toLowerCase().includes('cr') || type?.toLowerCase().includes('credit');
      const transactionType = isCredit ? 'credit' : 'debit';

      // Fingerprint: Hash of (Date + Amount + Merchant + User)
      const fingerString = `${date.toISOString()}|${amount}|${merchant}|${userId}`;
      const fingerprint = crypto.createHash('sha256').update(fingerString).digest('hex');

      // Check duplicate
      const existing = await transactionsQueries.findTransactionByFingerprint(userId, fingerprint);
      if (existing) {
        console.log(`[Extraction] Duplicate found for ${merchant} (${amount}), skipping.`);
        continue;
      }

      // Insert
      await transactionsQueries.createTransaction({
        userId,
        cardId: linkedCardId,
        transactionDate: date,
        merchant: merchant,
        category: 'Uncategorized', // Default
        amount: amount,
        transactionType: transactionType,
        description: `Imported from Statement: ${message.subject}`,
        txnFingerprint: fingerprint,
        emailSubject: message.subject,
        emailMessageId: message.id, // Link to the statement email
        isManuallyAdded: false
      });

      count++;
    }
  }

  return count;
}
