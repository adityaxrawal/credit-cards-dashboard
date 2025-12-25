import { BaseClassifier } from '../BaseClassifier';
import { InstrumentService } from '../../../cards/instruments/InstrumentService';
import { ClassificationResult, CleanEmail, TransactionType, InstrumentType } from '../../../../types/transaction.types';

export class BankAccountUPIDebitDetector extends BaseClassifier {
    readonly priority = 5;
    readonly name = 'BankAccountUPIDebitDetector';

    async classify(userId: string, email: CleanEmail): Promise<ClassificationResult | null> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        // ====== PRECONDITION: UPI Debit Keywords ======
        // "You paid", "Payment sent", "Debited via UPI"
        const hasKeywords = /upi/i.test(text) && (/paid|sent|debited/i.test(text));
        if (!hasKeywords) return null;

        // Prevent overlap with CC UPI (avoid matching "account" as "cc")
        if (/(?:credit card|\bcc\b|\bcard\b)/i.test(text) && !/bank account/i.test(text)) return null;

        // ====== EXTRACT ACCOUNT ======
        const accountMatch = text.match(/(?:account|a\/c)\s*(?:no\.|xx)?\s*(\d{4})/i);
        const last4 = accountMatch ? accountMatch[1] : null;

        // ====== VERIFY ACCOUNT/UPI ======
        const instruments = await InstrumentService.getUserInstruments(userId);
        let userInstrument = null;

        if (last4) {
            userInstrument = instruments.find(
                i => i.instrument_type === InstrumentType.SAVINGS_ACCOUNT &&
                    i.account_number_masked.endsWith(last4)
            );
        } else {
            // Try to find if user's UPI handle is mentioned
            const userUpis = instruments.filter(i => i.instrument_type === InstrumentType.UPI);
            for (const upi of userUpis) {
                if (upi.upi_handle && text.includes(upi.upi_handle.toLowerCase())) {
                    userInstrument = upi;
                    break;
                }
            }
        }

        if (!userInstrument && !last4) {
            // If we can't link to an account or found no account number, confidence drops
            // unless the sender is a known fintech (Jupiter/Slice) which implies account linkage
            const isFintech = /jupiter|slice|fi money|niyo/i.test(email.from);
            if (!isFintech) return null;
        }

        // ====== EXTRACT AMOUNT ======
        const amount = this.extractAmount(text);
        if (!amount || amount <= 0) return null;

        // ====== EXTRACT RECIPIENT ======
        const recipientMatch = text.match(/to\s+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i);
        const recipientUPI = recipientMatch ? recipientMatch[1] : null;

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_DEBIT,
            confidence: userInstrument ? 0.90 : 0.75,
            metadata: {
                accountLast4: last4,
                instrumentId: userInstrument?.id,
                recipientUPI,
                amount
            }
        };
    }
}
