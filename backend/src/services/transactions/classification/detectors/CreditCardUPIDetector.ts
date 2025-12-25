import { BaseClassifier } from '../BaseClassifier';
import { InstrumentService } from '../../../cards/instruments/InstrumentService';
import { ClassificationResult, CleanEmail, TransactionType, InstrumentType } from '../../../../types/transaction.types';

export class CreditCardUPIDetector extends BaseClassifier {
    readonly priority = 3;
    readonly name = 'CreditCardUPIDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // ====== PRECONDITION: UPI + Credit Card Keywords ======
        const hasKeywords = /upi/i.test(text) &&
            (/debit/i.test(text) || /paid/i.test(text)) &&
            (/credit card|cc|card/i.test(text));

        if (!hasKeywords) return null;

        // Pattern: "₹X debited from CC XX#### via UPI"
        const cardMatch = text.match(/(?:cc|card|no\.)\s*(?:xx)?(\d{4})/i);
        const last4 = cardMatch ? cardMatch[1] : null;

        if (!last4) return null;

        // ====== VERIFY CARD REGISTERED ======
        const instruments = await InstrumentService.getUserInstruments(userId);
        const userCard = instruments.find(
            i => i.instrument_type === InstrumentType.CREDIT_CARD &&
                i.account_number_masked.endsWith(last4)
        );

        if (!userCard) return null; // If strictly forcing registered card for this specific type

        // ====== EXTRACT AMOUNT ======
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) return null;

        return {
            type: TransactionType.CREDIT_CARD_UPI,
            confidence: 0.90,
            metadata: {
                cardLast4: last4,
                instrumentId: userCard.id,
                amount
            }
        };
    }
}
