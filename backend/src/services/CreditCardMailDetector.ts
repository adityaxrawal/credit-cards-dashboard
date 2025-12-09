import { gmail_v1 } from 'googleapis';
import { OllamaService } from './ollama.service';
import { EmailCleanerService } from './emailCleaner.service';
import { TransactionPrefilter } from '../utils/TransactionPrefilter';
import { MLClassificationResult } from '../types/ml-schema';

/**
 * Email Category Types
 * Mapped directly from ML classification results
 */
export type EmailCategory =
  | 'transaction_success'
  | 'refund'
  | 'statement'
  | 'otp'
  | 'non_transaction';

/**
 * Detection Result
 * Extended with ML-specific fields
 */
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
 * Credit Card Mail Detector - ML-Only Version
 * 
 * IMPORTANT: This class now uses 100% ML-based detection.
 * ALL regex-based and rule-based logic has been removed.
 * 
 * The only remaining purpose of SENDER_DOMAINS is for Gmail query optimization
 * during historical scans (to reduce API calls). It is NOT used for detection.
 */
export class CreditCardMailDetector {
  /**
   * Bank sender domains - ONLY used for Gmail query filtering
   * NOT used for detection/classification
   */
  public static readonly SENDER_DOMAINS = [
    // Universal government-mandated domain
    '.bank.in',

    // Major Indian Banks
    'hdfcbank.com', 'hdfcbank.net',
    'sbi.co.in', 'sbicard.com',
    'icicibank.com', 'icicibank.in',
    'axisbank.com', 'axisbank.co.in',
    'idfcfirstbank.com',
    'indusind.com', 'indusindbank.in',
    'citibank.com', 'citi.com',
    'americanexpress.com', 'aexp.com',
    'hsbc.co.in',
    'kotak.com', 'kotak.in',
    'rblbank.com',
    'sc.com', 'in.sc.com',
    'yesbank.in',
    'federalbank.co.in', 'federalbank.in',
    'aubank.in',
    'bankofbaroda.com', 'bankofbaroda.in',
    'canarabank.in',
    'pnbindia.in', 'pnb.co.in',
    'unionbankofindia.co.in',
    'bankofindia.co.in',
    'idbibank.in',
    'dbs.com'
  ];

  /**
   * Detect if an email is a credit card transaction email using ML
   * 
   * @param message Raw Gmail message
   * @returns Detection result with ML classification
   */
  static async detect(message: gmail_v1.Schema$Message): Promise<DetectionResult> {
    try {
      // Step 1: Clean email text
      const cleanedText = await EmailCleanerService.cleanEmailText(message);

      if (!cleanedText || cleanedText.length < 10) {
        return {
          isTransaction: false,
          category: 'non_transaction',
          confidence: 0.0,
          merchant: null,
          amount: null,
          currency: null,
          transactionDate: null,
          cardLast4: null,
          cleanedText: '',
          error: 'Email body too short or empty after cleaning'
        };
      }

      // Step 2: Signal-Based Prefilter (The "Fast Lane")
      // 10x Optimization: Discard obvious non-transactions immediately
      const prefilterResult = TransactionPrefilter.evaluate(cleanedText);

      if (!prefilterResult.shouldProcess) {
        // console.log('[Detector] Skipped via prefilter', prefilterResult);
        return {
          isTransaction: false,
          category: 'non_transaction',
          confidence: 0.0,
          merchant: null,
          amount: null,
          currency: null,
          transactionDate: null,
          cardLast4: null,
          cleanedText,
          needsReview: false
        };
      }

      // Step 3: ML classification
      let mlResult: MLClassificationResult;
      try {
        mlResult = await OllamaService.classifyEmail(cleanedText);
      } catch (mlError) {
        console.error('[CreditCardMailDetector] ML classification failed:', mlError);

        // Mark for manual review if ML fails
        return {
          isTransaction: false,
          category: 'non_transaction',
          confidence: 0.0,
          merchant: null,
          amount: null,
          currency: null,
          transactionDate: null,
          cardLast4: null,
          cleanedText,
          needsReview: true,
          error: `ML classification error: ${mlError instanceof Error ? mlError.message : 'Unknown error'}`
        };
      }

      // Step 4: Validate ML output
      const needsReview = mlResult.confidence < 0.7;

      return {
        isTransaction: mlResult.isTransaction,
        category: mlResult.category,
        confidence: mlResult.confidence,
        merchant: mlResult.merchant,
        amount: mlResult.amount,
        currency: mlResult.currency,
        transactionDate: mlResult.transactionDate,
        cardLast4: mlResult.cardLast4,
        cleanedText,
        needsReview,
        mlRawResponse: mlResult
      };

    } catch (error) {
      console.error('[CreditCardMailDetector] Unexpected error:', error);

      return {
        isTransaction: false,
        category: 'non_transaction',
        confidence: 0.0,
        merchant: null,
        amount: null,
        currency: null,
        transactionDate: null,
        cardLast4: null,
        cleanedText: '',
        needsReview: true,
        error: `Detection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Batch detect multiple emails (for efficiency)
   * Processes in parallel with concurrency limit
   */
  /**
   * Batch detect multiple emails (Prompt Packing Optimized)
   */
  static async detectBatch(
    messages: gmail_v1.Schema$Message[],
    concurrency: number = 3 // Concurrency of BATCHES (e.g. 3 concurrent batches of 5 = 15 emails being processed)
  ): Promise<DetectionResult[]> {
    const BATCH_SIZE = 3; // Reduced from 5 for better stability with 3B models

    // 1. Prefilter & Clean all
    const cleaned = await Promise.all(messages.map(async (msg, index) => {
      const text = await EmailCleanerService.cleanEmailText(msg);
      const prefilter = TransactionPrefilter.evaluate(text);
      return { index, msg, text, prefilter };
    }));

    // 2. Separate into "Process" and "Skip"
    const toProcess = cleaned.filter(c => c.prefilter.shouldProcess);
    const skipped = cleaned.filter(c => !c.prefilter.shouldProcess);

    // 3. Process in Batches
    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(concurrency);

    // Helper to chunk array
    const chunks = [];
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      chunks.push(toProcess.slice(i, i + BATCH_SIZE));
    }

    const processedResults = await Promise.all(chunks.map(chunk => limit(async () => {
      const emails = chunk.map(c => c.text);

      try {
        // CALL OLLAMA BATCH
        const mlResults = await OllamaService.classifyBatch(emails);

        // Map back to detection results
        return chunk.map((item, i) => {
          const ml = mlResults[i];
          const needsReview = ml.confidence < 0.7;

          return {
            originalIndex: item.index,
            result: {
              isTransaction: ml.isTransaction,
              category: ml.category as any,
              confidence: ml.confidence,
              merchant: ml.merchant,
              amount: ml.amount,
              currency: ml.currency,
              transactionDate: ml.transactionDate,
              cardLast4: ml.cardLast4,
              cleanedText: item.text,
              needsReview,
              mlRawResponse: ml
            } as DetectionResult
          };
        });
      } catch (err) {
        console.error('[Detector] Batch failed completely', err);
        // Fallback: mark all as error/needs review
        return chunk.map((item) => ({
          originalIndex: item.index,
          result: {
            isTransaction: false,
            category: 'non_transaction',
            confidence: 0,
            merchant: null,
            amount: null,
            currency: null,
            transactionDate: null,
            cardLast4: null,
            cleanedText: item.text,
            needsReview: true,
            error: 'Batch processing error'
          } as any
        }));
      }
    })));

    // Flatten processed results
    const flatProcessed = processedResults.flat();

    // 4. Transform Skipped
    const skippedResults = skipped.map(item => ({
      originalIndex: item.index,
      result: {
        isTransaction: false,
        category: 'non_transaction' as const,
        confidence: 0,
        merchant: null,
        amount: null,
        currency: null,
        transactionDate: null,
        cardLast4: null,
        cleanedText: item.text,
        needsReview: false
      } as DetectionResult
    }));

    // 5. Reassemble in original order
    const all = [...flatProcessed, ...skippedResults];
    all.sort((a, b) => a.originalIndex - b.originalIndex);

    return all.map(a => a.result);
  }
}
