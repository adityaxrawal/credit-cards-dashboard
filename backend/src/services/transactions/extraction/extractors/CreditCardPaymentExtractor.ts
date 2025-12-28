import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { InstrumentAutoService } from '../../../cards/instruments/InstrumentAutoService';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';

export class CreditCardPaymentExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        // Extract fields
        const amount = this.extractAmount(combined);
        const merchant = this.extractMerchant(combined); // Usually "Credit Card Bill" or Bank Name
        const cardLast4 = this.extractCardLast4(combined);
        const date = this.extractDate(text, email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        // Get or create instrument
        let instrumentId: string | undefined = undefined;
        if (cardLast4) {
            const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);
            instrumentId = instrument.id;
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date: date,
            cardLastFour: cardLast4 || undefined,
            direction: TransactionDirection.CREDIT // Payment TO the card is a CREDIT
        });

        return {
            type: TransactionType.CREDIT_CARD_PAYMENT,
            direction: TransactionDirection.CREDIT,
            amount,
            currency: this.extractCurrency(combined),
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            category: 'Bills & Utilities', // Standard category for payments
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                cardLast4,
                emailSubject: email.subject,
                extractedAt: new Date().toISOString()
            }
        };
    }

    private static extractAmount(text: string): number {
        return UniversalAmountExtractor.extract(text);
    }

    private static extractMerchant(text: string): string {
        // Try to identify the bank/issuer
        const lowerText = text.toLowerCase();
        if (lowerText.includes('hdfc')) return 'HDFC Bank Credit Card';
        if (lowerText.includes('sbi')) return 'SBI Credit Card';
        if (lowerText.includes('icici')) return 'ICICI Credit Card';
        if (lowerText.includes('axis')) return 'Axis Bank Credit Card';
        if (lowerText.includes('amex') || lowerText.includes('american express')) return 'American Express';

        return 'Credit Card Bill Payment';
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
        // Use email date as primary fallback if no specific transaction date found in text
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
