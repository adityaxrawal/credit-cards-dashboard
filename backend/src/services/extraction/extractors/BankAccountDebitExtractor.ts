import crypto from 'crypto';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../types/transaction.types';
import { InstrumentService } from '../../instruments/InstrumentService';
import { BankParserPatterns } from '../../../utils/regexCache';

export class BankAccountDebitExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        const amount = this.extractAmount(combined);
        const accountLast4 = this.extractAccountLast4(combined);
        const recipient = this.extractRecipient(combined);
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        let instrumentId: string | undefined = undefined;
        if (accountLast4) {
            const account = await InstrumentService.getAccountByIdentifier(userId, '', accountLast4);
            if (account) instrumentId = account.id;
        }

        const fingerprint = crypto.createHash('sha256')
            .update(`${email.id}-${date.toISOString()}-${amount}-${recipient}`)
            .digest('hex');

        return {
            type: TransactionType.BANK_DEBIT,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant: recipient,
            instrumentType: InstrumentType.SAVINGS_ACCOUNT,
            instrumentId,
            category: 'Transfer',
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                accountLast4,
                recipient,
            }
        };
    }

    private static extractAmount(text: string): number {
        const match = text.match(BankParserPatterns.AMOUNT_INR);
        if (match) return parseFloat(match[1].replace(/,/g, ''));

        // Fallback
        const commonPatterns = [
            /(?:debited|spent|paid|amount|for)\s+(?:[₹$€£]|rs\.?|inr|usd|eur|gbp)?\s*([\d,]+(?:\.\d{1,2})?)/i,
            /(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:is|has\s+been)\s+(?:debited|paid)/i,
            /valued\s+at\s+(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i
        ];

        for (const pattern of commonPatterns) {
            const m = text.match(pattern);
            if (m) return parseFloat(m[1].replace(/,/g, ''));
        }

        throw new Error('Amount not found');
    }

    private static extractAccountLast4(text: string): string | null {
        const patterns = [
            BankParserPatterns.CARD_XX_DIGITS,
            BankParserPatterns.CARD_ENDING,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    private static extractRecipient(text: string): string {
        const patterns = [
            BankParserPatterns.MERCHANT_AT,
            BankParserPatterns.MERCHANT_TO,
            BankParserPatterns.MERCHANT_WITH,
            BankParserPatterns.MERCHANT_FROM,
            /to\s+([A-Za-z0-9\s.&'-]+?)(?:\s+on|\.|via|$)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const recipient = match[1].trim();
                if (recipient.length > 2 && !BankParserPatterns.FALSE_MERCHANT.test(recipient)) {
                    return recipient;
                }
            }
        }

        return 'Unknown Recipient';
    }

    private static extractReferenceNumber(text: string): string | null {
        const patterns = [
            BankParserPatterns.REF_NUMBER_1,
            BankParserPatterns.REF_NUMBER_2,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }
}
