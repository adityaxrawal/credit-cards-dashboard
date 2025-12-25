import crypto from 'crypto';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { InstrumentService } from '../../../cards/instruments/InstrumentService';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';

export class CreditCardSpendExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        // Extract fields
        const amount = this.extractAmount(combined);
        const merchant = this.extractMerchant(combined);
        const cardLast4 = this.extractCardLast4(combined);
        const date = this.extractDate(text, email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        // Get instrument ID
        let instrumentId: string | undefined = undefined;
        if (cardLast4) {
            const card = await InstrumentService.getCardByIdentifier(userId, '', cardLast4);
            if (card) instrumentId = card.id;
        }

        const fingerprintData = `${email.id}-${date.toISOString()}-${amount}-${merchant}`;
        const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: this.extractCurrency(combined),
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            category: 'Shopping', // Default category
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                cardLast4,
                emailSubject: email.subject,
                extractedAt: new Date().toISOString(),
                isInternational: BankParserPatterns.KEYWORD_INTERNATIONAL.test(text)
            }
        };
    }

    private static extractAmount(text: string): number {
        const match = text.match(BankParserPatterns.AMOUNT_INTL);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }

        // Fallback for simple numbers
        const matchFallback = text.match(/spent\s+([\d,]+(?:\.\d{2})?)/i) ||
            text.match(/(?:for|amount)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (matchFallback) return parseFloat(matchFallback[1].replace(/,/g, ''));

        throw new Error('Amount not found');
    }

    private static extractMerchant(text: string): string {
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

        return 'Unknown Merchant';
    }

    private static extractCardLast4(text: string): string | null {
        const patterns = [
            BankParserPatterns.CARD_XX_DIGITS,
            BankParserPatterns.CARD_ENDING,
            BankParserPatterns.CARD_NUMBER,
            BankParserPatterns.CARD_MASKED,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1];
        }

        return null;
    }

    private static extractDate(text: string, fallback: number): Date {
        // Improvements: could add more date parsing logic here
        return new Date(fallback);
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

    private static extractCurrency(text: string): string {
        if (BankParserPatterns.CURRENCY_USD.test(text)) return 'USD';
        if (BankParserPatterns.CURRENCY_EUR.test(text)) return 'EUR';
        if (BankParserPatterns.CURRENCY_GBP.test(text)) return 'GBP';
        return 'INR';
    }
}
