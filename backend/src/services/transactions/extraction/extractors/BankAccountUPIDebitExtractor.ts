import crypto from 'crypto';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { InstrumentService } from '../../../cards/instruments/InstrumentService';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';

export class BankAccountUPIDebitExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        const amount = this.extractAmount(combined);
        const accountLast4 = this.extractAccountLast4(combined);
        const recipientUPI = this.extractRecipientUPI(combined);
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        let instrumentId: string | undefined = undefined;
        if (accountLast4) {
            const account = await InstrumentService.getAccountByIdentifier(userId, '', accountLast4);
            if (account) instrumentId = account.id;
        }

        const fingerprint = crypto.createHash('sha256')
            .update(`${email.id}-${date.toISOString()}-${amount}-${recipientUPI}`)
            .digest('hex');

        // Try to find a merchant name in the text if UPI handle is generic
        const merchant = this.extractMerchant(combined) || recipientUPI || 'UPI Merchant';

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_DEBIT,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            counterpartyIdentifier: recipientUPI || undefined,
            instrumentType: InstrumentType.SAVINGS_ACCOUNT,
            instrumentId,
            category: 'UPI',
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                accountLast4,
                recipientUPI,
            }
        };
    }

    private static extractAmount(text: string): number {
        const match = text.match(BankParserPatterns.AMOUNT_INR);
        if (match) return parseFloat(match[1].replace(/,/g, ''));
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

    private static extractRecipientUPI(text: string): string | null {
        const match = text.match(/to\s+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i);
        return match ? match[1] : null;
    }

    private static extractMerchant(text: string): string | null {
        const patterns = [
            BankParserPatterns.MERCHANT_AT,
            BankParserPatterns.MERCHANT_TO,
            BankParserPatterns.MERCHANT_WITH,
            BankParserPatterns.MERCHANT_FROM,
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const merchant = match[1].trim();
                if (merchant.length > 2 && !BankParserPatterns.FALSE_MERCHANT.test(merchant)) {
                    return merchant;
                }
            }
        }
        return null;
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
