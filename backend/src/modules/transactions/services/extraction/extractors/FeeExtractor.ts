import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

export class FeeExtractor {
    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        const fullText = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        const amount = UniversalAmountExtractor.extract(email.subject + ' ' + email.cleanedBody);

        let merchant = 'Bank Charge';
        const patternName = classification?.metadata?.pattern;

        if (patternName === 'DEMAT_CHARGES') {
            merchant = 'Demat Charges';
        } else if (fullText.includes('annual fee')) {
            merchant = 'Annual Fee';
        } else if (fullText.includes('membership fee')) {
            merchant = 'Membership Fee';
        } else if (fullText.includes('renewal fee')) {
            merchant = 'Renewal Fee';
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date: new Date(email.internalDate),
            direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.BANK_DEBIT, // Fees are technically bank debits or CC debits
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT, // Default to bank, but could be CC
            // We might need to look for card numbers to change instrument type
            instrumentId: undefined,
            category: 'Charges',
            fingerprint,
            metadata: {
                extractedAt: new Date().toISOString(),
                feeType: merchant
            }
        };
    }
}
