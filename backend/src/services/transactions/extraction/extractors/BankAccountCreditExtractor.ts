import crypto from 'crypto';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../types/transaction.types';
import { InstrumentService } from '../../instruments/InstrumentService';
import { BankParserPatterns } from '../../../utils/regexCache';

export class BankAccountCreditExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        const amount = this.extractAmount(combined);
        const accountLast4 = this.extractAccountLast4(combined);
        const source = this.extractSource(combined); // NEFT, SALARY, etc.
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        let instrumentId: string | undefined = undefined;
        if (accountLast4) {
            const account = await InstrumentService.getAccountByIdentifier(userId, '', accountLast4);
            if (account) instrumentId = account.id;
        }

        const fingerprint = crypto.createHash('sha256')
            .update(`${email.id}-${date.toISOString()}-${amount}-${source}`)
            .digest('hex');

        // Determine specific type: SALARY or BANK_CREDIT
        const type = /salary|payroll/i.test(source) ? TransactionType.SALARY : TransactionType.BANK_CREDIT;
        const category = type === TransactionType.SALARY ? 'Income' : 'Transfer';

        return {
            type,
            direction: TransactionDirection.CREDIT,
            amount,
            currency: 'INR',
            merchant: source,
            instrumentType: InstrumentType.SAVINGS_ACCOUNT,
            instrumentId,
            category,
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                accountLast4,
                source,
            }
        };
    }

    private static extractAmount(text: string): number {
        const match = text.match(BankParserPatterns.AMOUNT_INR);
        if (match) return parseFloat(match[1].replace(/,/g, ''));

        // Fallback for action-based extraction (credited/received)
        const commonPatterns = [
            /(?:credited|received|added|amount|for)\s+(?:[₹$€£]|rs\.?|inr|usd|eur|gbp)?\s*([\d,]+(?:\.\d{1,2})?)/i,
            /(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:is|has\s+been)\s+(?:credited|added)/i,
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

    private static extractSource(text: string): string {
        const lower = text.toLowerCase();
        if (/salary/i.test(lower)) return 'Salary';
        if (/neft/i.test(lower)) return 'NEFT';
        if (/rtgs/i.test(lower)) return 'RTGS';
        if (/imps/i.test(lower)) return 'IMPS';

        // Try generic merchant detection if transferred from X
        const patterns = [
            BankParserPatterns.MERCHANT_FROM,
            BankParserPatterns.MERCHANT_BY, // Might need to add BY to cache
            /from\s+([A-Za-z0-9\s.&'-]+?)(?:\s+on|\.|via|$)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const src = match[1].trim();
                if (src.length > 2 && !BankParserPatterns.FALSE_MERCHANT.test(src)) {
                    return src;
                }
            }
        }

        return 'Bank Transfer';
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
