import { CleanEmailContent } from '../sanitize/sanitizer';
import { EmailClassifier } from '../extraction/classifier';
import { SignalTransactionExtractor } from '../extraction/extractor';
import { ConfidenceScorer } from '../extraction/scorer';
import { getCategoryForMerchant } from '../../utils/merchantNormalizer';
import { GmailLinkGenerator } from '../../utils/gmailLinkGenerator';

export interface RuleResult {
    status: 'passed' | 'failed' | 'ignored';
    transaction?: any;
    reason?: string;
    confidenceScore?: number;
}

export class RuleProcessor {
    /**
     * Deterministic Rule-Based Extraction (Signal Driven)
     */
    static async process(email: CleanEmailContent): Promise<RuleResult> {
        // 1. Classify
        const kind = EmailClassifier.classify(email);

        if (kind === 'NON_FINANCIAL') {
            return { status: 'ignored', reason: 'Classified as NON_FINANCIAL' };
        }

        if (kind === 'CREDIT_CARD_STATEMENT') {
            // RuleProcessor historically handled transactions.
            // If it's a statement, we might return 'ignored' here so Pipeline handles it via 'processStatement'
            // OR we return a special status if the caller expects it.
            // Assuming Pipeline calls this for TRANSACTION candidate flow.
            return { status: 'failed', reason: 'Classified as STATEMENT (Requires PDF Processing)' };
        }

        // 2. Extract (Transaction)
        const result = SignalTransactionExtractor.extract(email);
        if (!result) {
            return { status: 'failed', reason: 'Extraction Failed (No signals)' };
        }

        // 3. Score
        const confidence = ConfidenceScorer.score(result, email);
        if (confidence.status === 'DISCARD') {
            return {
                status: 'failed',
                reason: `Low Confidence: ${confidence.score}`,
                confidenceScore: confidence.score
            };
        }

        // 4. Map to Result
        const transaction = {
            amount: result.amount,
            transactionDate: result.transactionDate,
            merchant: result.merchant,
            bankName: result.bankHint || 'Unknown Bank',
            lastFourDigits: result.cardLast4 || '0000',
            category: getCategoryForMerchant(result.merchant),
            transactionType: 'debit',
            emailSubject: email.subject,
            gmailMessageId: email.id,
            gmailThreadId: email.raw?.threadId,
            gmailLink: GmailLinkGenerator.generateLink(email.id),
            confidenceScore: confidence.score
        };

        return {
            status: 'passed',
            transaction,
            confidenceScore: confidence.score
        };
    }
}
