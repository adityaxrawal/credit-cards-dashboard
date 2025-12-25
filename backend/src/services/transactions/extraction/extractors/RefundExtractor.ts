import crypto from 'crypto';
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
        if (/account|bank/i.test(text)) instrumentType = InstrumentType.SAVINGS_ACCOUNT;

        const fingerprint = crypto.createHash('sha256')
            .update(`${email.id}-${date.toISOString()}-${amount}-refund`)
            .digest('hex');

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
        const match = text.match(/[₹](?:\s+)?([\d,]+(?:\.\d{2})?)/);
        if (match) return parseFloat(match[1].replace(/,/g, ''));
        throw new Error('Amount not found');
    }

    private static extractReferenceNumber(text: string): string | null {
        const match = text.match(/ref(?:erence)?\s*(?:no\.?)?\s*[:]\s*([A-Z0-9]+)/i);
        return match ? match[1] : null;
    }
}
