import { BaseClassifier } from '../BaseClassifier';
import { InstrumentService } from '@modules/cards/instrument.service';
import { ClassificationResult, CleanEmail, TransactionType, InstrumentType } from '@shared/types/transaction.types';

export class BankAccountCreditDetector extends BaseClassifier {
    readonly priority = 4;
    readonly name = 'BankAccountCreditDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // ====== PRECONDITION: Credit Keywords ======
        const hasCreditKeywords = /credited|added|received|transfer in|salary/i.test(text);
        if (!hasCreditKeywords) return null;

        // Exclude UPI credits (handled by BankAccountUPICreditDetector)
        if (/upi/i.test(text)) return null;

        // ====== EXTRACT ACCOUNT ======
        const accountMatch = text.match(/(?:account|a\/c)\s*(?:no\.|xx)?\s*(\d{4})/i);
        const last4 = accountMatch ? accountMatch[1] : null;

        // ====== VERIFY ACCOUNT ======
        let userAccount = null;
        if (last4) {
            const instruments = await InstrumentService.getUserInstruments(userId);
            userAccount = instruments.find(
                i => i.instrument_type === InstrumentType.BANK_ACCOUNT &&
                    i.account_number_masked.endsWith(last4)
            );
        }

        // ====== EXTRACT AMOUNT ======
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) return null;

        // ====== SUB-CLASSIFY: SALARY ======
        if (/salary/i.test(text) || /payroll/i.test(text)) {
            return {
                type: TransactionType.SALARY,
                confidence: 0.95,
                metadata: {
                    accountLast4: last4,
                    instrumentId: userAccount?.id,
                    amount,
                    source: 'salary'
                }
            };
        }

        return {
            type: TransactionType.BANK_CREDIT,
            confidence: userAccount ? 0.95 : 0.70,
            metadata: {
                accountLast4: last4,
                instrumentId: userAccount?.id,
                amount
            }
        };
    }
}
