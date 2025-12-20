import { BaseClassifier } from '../BaseClassifier';
import { ClassificationResult, CleanEmail, TransactionType } from '../../../types/transaction.types';

export class RefundReversalDetector extends BaseClassifier {
    readonly priority = 7;
    readonly name = 'RefundReversalDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // ====== PRECONDITION: Refund Keywords ======
        const hasKeywords = /refund|reversal|reversed|chargeback|cancelled/i.test(text);
        if (!hasKeywords) return null;

        // ====== SUB-CLASSIFY: CHARGEBACK ======
        if (/chargeback/i.test(text)) {
            return {
                type: TransactionType.CHARGEBACK,
                confidence: 0.95,
                metadata: { reason: 'chargeback' }
            };
        }

        // ====== EXTRACT AMOUNT ======
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) return null;

        return {
            type: TransactionType.REFUND_REVERSAL,
            confidence: 0.90, // Validated keywords + amount
            metadata: {
                amount,
                type: 'refund'
            }
        };
    }
}
