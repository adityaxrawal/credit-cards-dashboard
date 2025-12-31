import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';

export class RefundExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        const amount = this.extractAmount(text);
        const isChargeback = /chargeback/i.test(text);
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(text); // Usually Refund Ref or semantic ref

        // Attempt to extract original reference to link
        // Not easy without explicit pattern like "Ref: XXXXX"

        // We don't know the instrument type easily unless we parse "credit card" or "account"
        let instrumentType = InstrumentType.CREDIT_CARD; // Default guess or unclassified?
        if (/account|bank/i.test(text)) instrumentType = InstrumentType.BANK_ACCOUNT;

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant: 'Refund/Reversal',
            date: date,
            direction: TransactionDirection.CREDIT
        });

        return {
            type: isChargeback ? TransactionType.CHARGEBACK : TransactionType.REFUND_REVERSAL,
            direction: TransactionDirection.CREDIT, // Reversal is money back
            amount,
            currency: 'INR',
            merchant: 'Refund/Reversal',
            instrumentType, // Best guess
            // instrumentId: ... hard to get without more parsing
            category: 'Refund',
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                isChargeback,
                originalRef: referenceNumber
            }
        };
    }

    private static extractAmount(text: string): number {
        // Strict: Look for amount near "refund", "reversal", "credit"
        // e.g. "Refund of Rs 500", "Rs 500 refunded"
        const strictPattern = /(?:refund|reversal|credit|back).{0,20}(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i;
        const strictMatch = text.match(strictPattern);
        if (strictMatch) return parseFloat(strictMatch[1].replace(/,/g, ''));

        // Reverse: "Rs 500 refunded"
        const strictReverse = /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)\s*.{0,20}(?:refund|reversal|credit|back)/i;
        const reverseMatch = text.match(strictReverse);
        if (reverseMatch) return parseFloat(reverseMatch[1].replace(/,/g, ''));

        // Contextual: "sent a refund of Rs 500", "refund credited Rs 500"
        const contextMatch = text.match(/(?:refund|reversal|credit).{0,30}(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (contextMatch) return parseFloat(contextMatch[1].replace(/,/g, ''));

        // Fallback (only if matched as REFUND type initially)
        const match = text.match(/[₹](?:\s+)?([\d,]+(?:\.\d{2})?)/);
        if (match) return parseFloat(match[1].replace(/,/g, ''));

        throw new Error('Amount not found');
    }

    private static extractReferenceNumber(text: string): string | null {
        const match = text.match(/ref(?:erence)?\s*(?:no\.?)?\s*[:]\s*([A-Z0-9]+)/i);
        return match ? match[1] : null;
    }
}
