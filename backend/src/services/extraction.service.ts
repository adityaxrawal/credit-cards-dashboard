import * as cheerio from 'cheerio';
import { MerchantNormalizer } from '../lib/merchantNormalizer';
import * as cardsQueries from '../db/queries/cards.queries';
import { PdfParser } from './extraction/PdfParser';
import { GmailLinkGenerator } from '../utils/GmailLinkGenerator';
import { CreditCardMailDetector, DetectionResult } from './CreditCardMailDetector';
import { OllamaService } from './ollama.service';
import { GmailMessage } from '../lib/gmailClient';

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

interface ExtractionResult {
  status: 'success' | 'error' | 'unknown_format';
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
  mlConfidence?: number;
  needsReview?: boolean;
}

/**
 * Extract transaction from email using ML-only pipeline
 * 
 * BREAKING CHANGE: This now uses ML for detection and classification.
 * Bank-specific parsers have been deprecated and are no longer used.
 */
export async function extractTransactionFromEmail(
  userId: string,
  message: ExtractionInput,
  fetchAttachment?: AttachmentFetcher,
  preComputedDetection?: DetectionResult
): Promise<ExtractionResult> {
  try {
    // Convert ExtractionInput to gmail_v1.Schema$Message format
    const gmailMessage = convertToGmailMessage(message);

    // Step 1: ML Detection (or use pre-computed)
    let detection = preComputedDetection || await CreditCardMailDetector.detect(gmailMessage);

    // Optimization: If pre-computed was just a prefilter skip, respect it
    // But if we are here, we likely want to force check if it wasn't skipped

    if (!detection.isTransaction) {
      // If ML says no, trust it.
      return {
        status: 'unknown_format',
        error: `ML classified as ${detection.category} (not a transaction)`,
        mlConfidence: detection.confidence,
        needsReview: detection.needsReview
      };
    }

    // Step 2: Validate ML Extraction
    // We need at least Merchant and Amount to be useful
    if (detection.merchant && detection.amount !== null) {
      return buildSuccessResult(detection, message);
    }

    // Step 3: Fallback - Try PDF Attachments if main body extraction failed
    // Only if we have PDF attachments and extraction failed to get critical fields
    if (message.attachments && message.attachments.length > 0 && fetchAttachment) {
      console.log(`[ExtractionService] Main body extraction incomplete (Merchant: ${detection.merchant}, Amount: ${detection.amount}), checking ${message.attachments.length} attachments...`);

      for (const att of message.attachments) {
        if (att.mimeType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          const buffer = await fetchAttachment(message.id, att.id);
          if (buffer) {
            try {
              // Extract text from PDF
              const pdfText = await PdfParser.extractText(buffer);
              const cleanPdfText = PdfParser.cleanText(pdfText);

              // RE-RUN ML on PDF Text
              console.log(`[ExtractionService] Running ML on PDF text for ${att.filename}`);
              const pdfMlResult = await OllamaService.classifyEmail(cleanPdfText);

              if (pdfMlResult.isTransaction && pdfMlResult.merchant && pdfMlResult.amount !== null) {
                console.log(`[ExtractionService] Successfully extracted from PDF: ${att.filename}`);

                // Merge PDF result into detection result
                detection = {
                  ...detection,
                  merchant: pdfMlResult.merchant,
                  amount: pdfMlResult.amount,
                  currency: pdfMlResult.currency,
                  transactionDate: pdfMlResult.transactionDate,
                  cardLast4: pdfMlResult.cardLast4,
                  confidence: pdfMlResult.confidence,
                  cleanedText: cleanPdfText // Update evidence to point to PDF text
                };

                return buildSuccessResult(detection, message);
              }
            } catch (pdfErr) {
              console.warn(`[ExtractionService] Failed to parse/ML PDF ${att.filename}:`, pdfErr);
            }
          }
        }
      }
    }

    // If we reach here, we failed to get critical info even after checking PDFs
    return {
      status: 'error',
      error: 'ML could not extract merchant or amount',
      mlConfidence: detection.confidence,
      needsReview: true
    };

  } catch (error) {
    console.error('[ExtractionService] Error extracting transaction:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      needsReview: true
    };
  }
}

/**
 * Build successful extraction result from DetectionResult
 */
function buildSuccessResult(
  detection: DetectionResult,
  message: ExtractionInput
): ExtractionResult {
  // Parse date or fallback to email date
  let txDate = message.date;
  if (detection.transactionDate) {
    const parsedDate = new Date(detection.transactionDate);
    if (!isNaN(parsedDate.getTime())) {
      txDate = parsedDate;
    }
  }

  // Derive Bank Name from Sender (Simple mapping only, fallback to Unknown)
  const bankName = deriveBankName(message.from, detection.merchant || '');

  return {
    status: 'success',
    transaction: {
      amount: detection.amount || 0,
      transactionDate: txDate,
      merchant: MerchantNormalizer.normalize(detection.merchant) || 'Unknown Merchant',
      bankName: bankName,
      lastFourDigits: detection.cardLast4 || '0000',
      category: 'Others', // We could map detection.category if we had spending categories
      exactTimestamp: message.date,
      transactionType: 'debit', // Default to debit/purchase
      currencyCode: detection.currency || 'INR',
      emailSubject: message.subject,
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      gmailLink: GmailLinkGenerator.generateLink(message.id),
      gmailThreadLink: message.threadId ? GmailLinkGenerator.generateThreadLink(message.threadId) : undefined,
    },
    mlConfidence: detection.confidence,
    needsReview: detection.needsReview
  };
}

/**
 * Simple helper to derive bank name from sender
 * Kept as a minor heuristic for metadata, not critical decision making
 */
function deriveBankName(sender: string, merchant: string): string {
  const lowerSender = sender.toLowerCase();

  if (lowerSender.includes('hdfc')) return 'HDFC Bank';
  if (lowerSender.includes('sbi')) return 'SBI Card';
  if (lowerSender.includes('icici')) return 'ICICI Bank';
  if (lowerSender.includes('axis')) return 'Axis Bank';
  if (lowerSender.includes('kotak')) return 'Kotak Mahindra Bank';
  if (lowerSender.includes('amex') || lowerSender.includes('americanexpress')) return 'American Express';
  if (lowerSender.includes('citi')) return 'Citibank';
  if (lowerSender.includes('hsbc')) return 'HSBC';
  if (lowerSender.includes('indusind')) return 'IndusInd Bank';
  if (lowerSender.includes('rbl')) return 'RBL Bank';
  if (lowerSender.includes('yes')) return 'Yes Bank';
  if (lowerSender.includes('sc.com') || lowerSender.includes('standardchartered')) return 'Standard Chartered';
  if (lowerSender.includes('idfc')) return 'IDFC FIRST Bank';

  return 'Unknown Bank';
}

/**
 * Convert ExtractionInput to Gmail message format for ML detection
 */
function convertToGmailMessage(input: ExtractionInput): any {
  return {
    id: input.id,
    threadId: input.threadId,
    snippet: input.bodyText.substring(0, 200),
    payload: {
      headers: [
        { name: 'Subject', value: input.subject },
        { name: 'From', value: input.from },
        { name: 'Date', value: input.date.toISOString() } // Fixed date handling
      ],
      body: {
        data: Buffer.from(input.bodyText).toString('base64')
      },
      parts: input.bodyHtml ? [{
        mimeType: 'text/html',
        body: {
          data: Buffer.from(input.bodyHtml).toString('base64')
        }
      }] : []
    },
    internalDate: input.date.getTime().toString()
  };
}

