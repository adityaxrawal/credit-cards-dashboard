import { BaseClassifier } from '../BaseClassifier';
import { InstrumentService } from '../../../cards/instruments/InstrumentService';
import { ClassificationResult, CleanEmail, TransactionType, InstrumentType } from '../../../../types/transaction.types';

export class BankAccountUPICreditDetector extends BaseClassifier {
    readonly priority = 6;
    readonly name = 'BankAccountUPICreditDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // ====== PRECONDITION: Receipt Keywords ======
        const hasKeywords = /upi/i.test(text) && (/received|credited|inbound/i.test(text));
        if (!hasKeywords) return null;

        // ====== EXTRACT ACCOUNT ======
        const accountMatch = text.match(/(?:account|a\/c)\s*(?:no\.|xx)?\s*(\d{4})/i);
        const last4 = accountMatch ? accountMatch[1] : null;

        // ====== VERIFY ACCOUNT ======
        let userAccount = null;
        if (last4) {
            const instruments = await InstrumentService.getUserInstruments(userId);
            userAccount = instruments.find(
                i => i.instrument_type === InstrumentType.SAVINGS_ACCOUNT &&
                    i.account_number_masked.endsWith(last4)
            );
        }

        // ====== EXTRACT AMOUNT ======
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) return null;

        // ====== EXTRACT SENDER ======
        const senderMatch = text.match(/from\s+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i);
        const senderUPI = senderMatch ? senderMatch[1] : null;

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_CREDIT,
            confidence: userAccount ? 0.95 : 0.80,
            metadata: {
                accountLast4: last4,
                instrumentId: userAccount?.id,
                senderUPI,
                amount
            }
        };
    }
}
