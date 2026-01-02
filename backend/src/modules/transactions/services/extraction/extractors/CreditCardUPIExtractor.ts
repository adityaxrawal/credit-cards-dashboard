import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';
import { BankParserPatterns } from '@shared/utils/cache/regexCache';

export class CreditCardUPIExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        // Extract fields
        const amount = this.extractAmount(combined);
        const cardLast4 = this.extractCardLast4(combined);
        const upiRecipient = this.extractUpiRecipient(combined);
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        // Get or create instrument
        let instrumentId: string | undefined = undefined;
        if (cardLast4) {
            const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);
            instrumentId = instrument.id;
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant: upiRecipient || 'UPI Merchant',
            date: date,
            cardLastFour: cardLast4 || undefined,
            direction: TransactionDirection.DEBIT
        });

        // Try to find a merchant name in the text if UPI handle is generic
        const merchant = this.extractMerchant(combined) || upiRecipient || 'UPI Merchant';

        return {
            type: TransactionType.CREDIT_CARD_UPI,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            counterpartyIdentifier: upiRecipient || undefined,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            category: 'UPI',
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                cardLast4,
                upiRecipient,
                emailSubject: email.subject,
            }
        };
    }

    private static extractAmount(text: string): number {
        const match = text.match(BankParserPatterns.AMOUNT_INR);
        if (match) return parseFloat(match[1].replace(/,/g, ''));
        throw new Error('Amount not found');
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

    private static extractUpiRecipient(text: string): string | null {
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
