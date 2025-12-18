import { SignalTransactionExtractor } from './extractor';
import { ConfidenceScorer } from './scorer';
import { CleanEmailContent } from '../sanitize/sanitizer';
import { getCategoryForMerchant } from '../../utils/merchantNormalizer';
import { GmailLinkGenerator } from '../../utils/gmailLinkGenerator';

export interface ExtractedEmailTransaction {
    amount: number;
    transactionDate: Date;
    merchant: string;
    bankName: string;
    lastFourDigits: string;
    category: string;
    transactionType: string;
    currencyCode?: string;
    originalAmount?: number;
    emailSubject: string;
    emailMessageId: string;
    gmailThreadId?: string;
    confidenceScore: number;
    extractionMethod: 'rule_based';
}

export class TransactionExtractor {

    /**
     * Parse an email for a credit card transaction using Signal-Based Rules
     */
    static async extract(email: {
        id: string;
        subject: string;
        from: string;
        cleanedBody: string;
        date: Date;
        raw?: { threadId?: string; snippet?: string };
    }): Promise<ExtractedEmailTransaction | null> {

        const cleanEmail: CleanEmailContent = {
            id: email.id,
            subject: email.subject,
            from: email.from,
            date: email.date,
            cleanedBody: email.cleanedBody,
            hasAttachments: false,
            raw: {
                snippet: email.raw?.snippet || '',
                threadId: email.raw?.threadId || '',
                messageId: email.id,
                internalDate: email.date.getTime(),
                subject: email.subject,
                from: email.from
            } as any
        };

        // 1. Extract
        const result = SignalTransactionExtractor.extract(cleanEmail);
        if (!result) return null;

        // 2. Score
        const confidence = ConfidenceScorer.score(result, cleanEmail);

        // 3. Gate
        if (confidence.status === 'DISCARD') {
            return null;
        }

        // 4. Transform to Legacy Interface
        const bankName = result.bankHint || this.inferBank(email.from) || 'Unknown Bank';

        // Category
        const category = getCategoryForMerchant(result.merchant);

        return {
            amount: result.amount,
            transactionDate: result.transactionDate,
            merchant: result.merchant,
            bankName: bankName,
            lastFourDigits: result.cardLast4 || '0000',
            category: category,
            transactionType: 'debit',
            currencyCode: result.currency,
            emailSubject: email.subject,
            emailMessageId: email.id,
            gmailThreadId: email.raw?.threadId,
            confidenceScore: confidence.score,
            extractionMethod: 'rule_based'
        };
    }

    private static inferBank(from: string): string {
        const f = from.toLowerCase();
        if (f.includes('hdfc')) return 'HDFC Bank';
        if (f.includes('sbi')) return 'SBI Card';
        if (f.includes('icici')) return 'ICICI Bank';
        if (f.includes('axis')) return 'Axis Bank';
        if (f.includes('amex') || f.includes('americanexpress')) return 'Amex';
        if (f.includes('idfc')) return 'IDFC First';
        if (f.includes('onecard')) return 'OneCard';
        if (f.includes('kotak')) return 'Kotak Bank';
        return 'Unknown Bank';
    }
}
