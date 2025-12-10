import { gmail_v1 } from 'googleapis';
import { OllamaService } from './ollama.service';
import { EmailCleanerService } from './emailCleaner.service';
import { TransactionPrefilter } from '../utils/TransactionPrefilter';
import { MLClassificationResult } from '../types/ml-schema';

export type EmailCategory =
  | 'transaction_success'
  | 'refund'
  | 'statement'
  | 'otp'
  | 'non_transaction';

export interface DetectionResult {
  isTransaction: boolean;
  category: EmailCategory;
  confidence: number;
  merchant: string | null;
  amount: number | null;
  currency: string | null;
  transactionDate: string | null;
  cardLast4: string | null;
  cleanedText: string;
  needsReview?: boolean;
  mlRawResponse?: MLClassificationResult;
  error?: string;
}

/**
 * Credit Card Mail Detector - ML-Only Optimized Version
 * 
 * Flow:
 * 1. Clean & Window (EmailCleaner)
 * 2. Signal Prefilter (TransactionPrefilter)
 * 3. ML Inference (OllamaService - Single Stream)
 */
export class CreditCardMailDetector {

  // SENDER_DOMAINS used only for Gmail Query filtering upstream
  public static readonly SENDER_DOMAINS = [
    '.bank.in', 'hdfcbank.com', 'hdfcbank.net', 'sbi.co.in', 'sbicard.com', 'icicibank.com', 'icicibank.in',
    'axisbank.com', 'axisbank.co.in', 'idfcfirstbank.com', 'indusind.com', 'indusind.com', 'citibank.com', 'citi.com',
    'americanexpress.com', 'aexp.com', 'hsbc.co.in', 'kotak.com', 'kotak.in', 'rblbank.com', 'sc.com', 'in.sc.com',
    'yesbank.in', 'federalbank.co.in', 'aubank.in', 'bankofbaroda.com', 'canarabank.in', 'pnbindia.in', 'unionbankofindia.co.in',
    'idbibank.in', 'dbs.com'
  ];

  public static readonly TRANSACTION_KEYWORDS = [
    'transaction', 'alert', 'spent', 'debited', 'credited', 'statement', 'bill', 'due', 'payment', 'charge', 'otp'
  ];

  static cleanMerchant(rawMerchant: string | null): string | null {
    if (!rawMerchant) return null;
    let cleaned = rawMerchant
      .replace(/\s*(PVT\.?\s*LTD\.?|PRIVATE\s*LIMITED|LIMITED|LTD|INC|CORP|LLC)$/gi, '')
      .replace(/\s+(BANGALORE|BENGALURU|MUMBAI|DELHI|CHENNAI|HYDERABAD|PUNE|KOLKATA|GURGAON|NOIDA|GURUGRAM)$/gi, '')
      .replace(/\s+INDIA$/gi, '')
      .replace(/\s+\d{2}:\d{2}(:\d{2})?/g, '') // Timestamps
      .replace(/\b(XX|xx)\d{4}\b/g, '') // Masked info
      .replace(/\s+(AT|ON|FROM|VIA)\s+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || null;
  }

  static async detect(message: gmail_v1.Schema$Message): Promise<DetectionResult> {
    try {
      // Extract Metadata for Logging
      const messageId = message.id || 'unknown';
      let subject = 'No Subject';
      if (message.payload?.headers) {
        const subjectHeader = message.payload.headers.find(h => h.name === 'Subject');
        if (subjectHeader?.value) subject = subjectHeader.value;
      }

      // 1. Clean & Window
      const cleanedText = await EmailCleanerService.cleanEmailText(message);

      if (!cleanedText || cleanedText.length < 5) {
        return this.getDefaultResult('too_short', cleanedText);
      }

      // 2. Prefilter (Fast Lane)
      const prefilter = TransactionPrefilter.evaluate(cleanedText);
      if (!prefilter.shouldProcess) {
        return this.getDefaultResult('non_transaction', cleanedText);
      }

      // 3. ML Inference (Sequential)
      // Pass metadata for logging
      const mlResult = await OllamaService.classifyEmail(cleanedText, { messageId, subject });

      const CONFIDENCE_THRESHOLD = parseFloat(process.env.ML_CONFIDENCE_THRESHOLD || '0.7');
      const needsReview = mlResult.confidence < CONFIDENCE_THRESHOLD;

      return {
        isTransaction: mlResult.isTransaction,
        category: mlResult.category,
        confidence: mlResult.confidence,
        merchant: this.cleanMerchant(mlResult.merchant),
        amount: mlResult.amount,
        currency: mlResult.currency,
        transactionDate: mlResult.transactionDate,
        cardLast4: mlResult.cardLast4,
        cleanedText,
        needsReview,
        mlRawResponse: mlResult
      };

    } catch (error) {
      console.error('[CreditCardMailDetector] Error:', error);
      return {
        ...this.getDefaultResult('error', ''),
        error: error instanceof Error ? error.message : 'Unknown'
      };
    }
  }

  // Removed detectBatch to enforce sequential processing via detect()

  private static getDefaultResult(category: string, cleanedText: string): DetectionResult {
    return {
      isTransaction: false,
      category: 'non_transaction',
      confidence: 0,
      merchant: null,
      amount: null,
      currency: null,
      transactionDate: null,
      cardLast4: null,
      cleanedText,
      needsReview: false
    };
  }
}
