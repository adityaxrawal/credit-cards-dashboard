import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { InstrumentAutoService } from '../../../cards/instruments/InstrumentAutoService';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';
import { isKnownBankSender } from '../../../../data/transaction-patterns';

export class BankAccountCreditExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        const amount = this.extractAmount(combined);
        const accountLast4 = this.extractAccountLast4(combined);
        const source = this.extractSource(combined); // NEFT, SALARY, etc.
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        // Get or create instrument
        let instrumentId: string | undefined = undefined;
        if (accountLast4) {
            const instrument = await InstrumentAutoService.findOrCreateAccount(userId, accountLast4, email);
            instrumentId = instrument.id;
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant: source,
            date: date,
            cardLastFour: accountLast4 || undefined,
            direction: TransactionDirection.CREDIT
        });

        // Determine specific type: SALARY or BANK_CREDIT
        let type = /salary|payroll/i.test(source) ? TransactionType.SALARY : TransactionType.BANK_CREDIT;

        // Safety: If identified as SALARY but sender is not a known bank, downgrade to Transfer
        // This prevents "Salary Negotiation" emails from being classified as Income
        if (type === TransactionType.SALARY) {
            const senderCheck = isKnownBankSender(email.from);
            if (!senderCheck.isKnown) {
                type = TransactionType.BANK_CREDIT;
            }
        }

        const category = type === TransactionType.SALARY ? 'Income' : 'Transfer';

        return {
            type,
            direction: TransactionDirection.CREDIT,
            amount,
            currency: 'INR',
            merchant: source,
            instrumentType: InstrumentType.BANK_ACCOUNT,
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
        // 1. Precise Match with Code/Symbol (e.g. INR 50,000, Rs. 5000)
        const match = text.match(BankParserPatterns.AMOUNT_INR);
        if (match) return parseFloat(match[1].replace(/,/g, ''));

        // 2. Context-based extraction (Credited X, Received X)
        const actionPatterns = [
            /(?:credited|received|added|deposited)\s+(?:with|of)?\s*(?:[₹$€£]|rs\.?|inr|usd)?\s*([\d,]+(?:\.\d{1,2})?)/i,
            /(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:is|was|has\s+been)\s+(?:credited|added|received)/i,
            /(?:amt|amount|txn|transaction)\s*(?:of)?\s*(?:[₹$€£]|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)/i
        ];

        for (const pattern of actionPatterns) {
            const m = text.match(pattern);
            if (m && m[1]) return parseFloat(m[1].replace(/,/g, ''));
        }

        // 3. Fallback: Look for "INR X" or "Rs X" anywhere if not found above
        const loosePattern = /(?:inr|rs\.?|₹)\s*[\.:]?\s*([\d,]+(?:\.\d{1,2})?)/i;
        const looseMatch = text.match(loosePattern);
        if (looseMatch && looseMatch[1]) {
            return parseFloat(looseMatch[1].replace(/,/g, ''));
        }

        throw new Error('Amount not found');
    }

    private static extractAccountLast4(text: string): string | null {
        const patterns = [
            /(?:account|a\/c)\s+(?:ending|ending\s+with|ending\s+in|no|number)[\s:]*(?:x+|X+)?(\d{4})/i,
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
            /payment\s+from\s*[:\-]?\s*([A-Za-z0-9\s.&'-]+?)(?:\s+on|\s+date|\.|via|info|$)/i,
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
