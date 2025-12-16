import { CleanEmailContent } from '../sanitize/sanitizer';
import { BankParsers, ParsedTransaction } from '../../services/extraction/bankParsers';
import { MerchantExtractor } from '../../utils/merchantExtractor';
import { normalizeMerchant, getCategoryForMerchant } from '../../utils/merchantNormalizer';
import { calculateConfidence, ExtractionDetails } from '../../utils/confidenceScoring';
import { GmailLinkGenerator } from '../../utils/gmailLinkGenerator';

export interface RuleResult {
    status: 'passed' | 'failed' | 'ignored';
    transaction?: any; // strict type later
    reason?: string;
    confidenceScore?: number;
}

export class RuleProcessor {
    /**
     * Deterministic Rule-Based Extraction
     * Output: PASS (Transaction) or FAIL (Reason for GPT)
     */
    static async process(email: CleanEmailContent): Promise<RuleResult> {
        // 1. Find Parser
        const parser = BankParsers.find(p =>
            p.identifiers.some(id =>
                email.from.toLowerCase().includes(id) ||
                email.subject.toLowerCase().includes(id)
            )
        );

        if (!parser) {
            return { status: 'failed', reason: 'No matching bank parser found' };
        }

        // 2. Parse Text
        // Note: We use the already cleaned body from Sanitizer!
        let parsed: ParsedTransaction | null = parser.parse(email.cleanedBody, email.subject, email.from, email.date);

        if (!parsed) {
            // Try fallback to normalized/merchant extraction if basic parse failed but we had a parser?
            // Usually parser.parse handles regex. If it returns null, it failed.
            return { status: 'failed', reason: 'Parser matched but extraction failed' };
        }

        // 3. Post-Process (Merchant Normalization, Fallbacks)
        if (!parsed.merchant || parsed.merchant === 'Unknown Merchant') {
            const fallback = MerchantExtractor.extract(email.cleanedBody);
            if (fallback) parsed.merchant = fallback;
        }

        parsed.merchant = normalizeMerchant(parsed.merchant);
        if (!parsed.category || parsed.category === 'Others') {
            parsed.category = getCategoryForMerchant(parsed.merchant);
        }

        // 4. Confidence Scoring
        const confidence = this.getConfidence(parsed, parser.name);

        // 5. Decision
        if (confidence.needsGptReview) {
            return {
                status: 'failed',
                reason: `Low confidence: ${confidence.score}`,
                confidenceScore: confidence.score
            };
        }

        // 6. Return Transaction Ready for Insert
        const transaction = {
            amount: parsed.amount,
            transactionDate: parsed.transactionDate,
            merchant: parsed.merchant,
            bankName: parsed.bankName,
            lastFourDigits: parsed.lastFourDigits,
            category: parsed.category,
            transactionType: parsed.transactionType || 'debit',
            emailSubject: email.subject,
            gmailMessageId: email.id,
            gmailThreadId: email.raw.threadId,
            gmailLink: GmailLinkGenerator.generateLink(email.id),
            confidenceScore: confidence.score
        };

        return { status: 'passed', transaction, confidenceScore: confidence.score };
    }

    private static getConfidence(parsed: ParsedTransaction, parserName: string) {
        const extractionDetails: ExtractionDetails = {
            amount: parsed.amount,
            amountSource: parsed.amount > 0 ? 'regex' : 'missing',
            merchant: parsed.merchant,
            merchantFound: parsed.merchant !== 'Unknown Merchant' && parsed.merchant !== 'UNKNOWN',
            date: parsed.transactionDate,
            dateSource: parsed.exactTimestamp ? 'body' : 'timestamp',
            cardLast4: parsed.lastFourDigits,
            cardFound: !!parsed.lastFourDigits && parsed.lastFourDigits !== '0000',
            bankName: parsed.bankName,
            bankSource: parserName ? 'sender' : 'missing',
            transactionType: parsed.transactionType === 'international' ? 'PURCHASE' : 'PURCHASE',
            category: parsed.category,
            categorySource: parsed.category !== 'Others' ? 'keyword' : 'unknown',
        };

        return calculateConfidence(extractionDetails);
    }
}
