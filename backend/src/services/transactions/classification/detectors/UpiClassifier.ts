
import { BaseClassifier } from '../BaseClassifier';
import { ClassificationResult, CleanEmail, TransactionType } from '../../../../types/transaction.types';

export class UpiClassifier extends BaseClassifier {
    readonly priority = 2;
    readonly name = 'UPI Classifier';

    async classify(userId: string, cleanEmail: CleanEmail): Promise<ClassificationResult | null> {
        const text = (cleanEmail.subject + ' ' + cleanEmail.cleanedBody).toLowerCase();

        // UPI Detection Logic
        // Patterns: "UPI", "VPA", "Unified Payments Interface"
        if (!text.includes('upi') && !text.includes('vpa')) return null;

        const amount = this.extractAmount(text);
        if (!amount) return null;

        // Determine Direction
        let direction: 'credit' | 'debit' = 'debit';
        if (text.includes('credited') || text.includes('received') || text.includes('added to')) {
            direction = 'credit';
        }

        // Determine Type
        let type: TransactionType = TransactionType.BANK_ACCOUNT_UPI_DEBIT;
        if (direction === 'credit') {
            type = TransactionType.BANK_ACCOUNT_UPI_CREDIT;
        } else {
            // Check if it's Credit Card UPI
            if (text.includes('credit card') || text.includes('rupom')) {
                type = TransactionType.CREDIT_CARD_UPI;
            }
        }

        // Use internalDate (number) for date extraction
        const date = this.extractDate(text, cleanEmail.internalDate);

        // Extract Merchant (simple heuristic)
        // Look for "paid to" or "received from"
        let merchant = 'UPI User';
        const paidToMatch = text.match(/paid to\s+([a-z0-9\s]+?)(?:\s+(?:via|using|on)|$)/i);
        const receivedFromMatch = text.match(/received from\s+([a-z0-9\s]+?)(?:\s+(?:via|using|on)|$)/i);

        if (direction === 'debit' && paidToMatch) merchant = this.cleanMerchantName(paidToMatch[1]);
        if (direction === 'credit' && receivedFromMatch) merchant = this.cleanMerchantName(receivedFromMatch[1]);

        return {
            type,
            confidence: 0.95,
            metadata: {
                original_merchant: merchant,
                payment_mode: 'UPI',
                related_message_ids: [cleanEmail.id]
            }
        };
    }
}
