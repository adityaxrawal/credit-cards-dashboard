import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { InstrumentAutoService } from '../../../cards/instruments/InstrumentAutoService';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';
import { UPIParser } from '../../../../utils/text/UPIParser';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';

export class BankAccountUPIDebitExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const combined = email.subject + ' ' + email.cleanedBody;

        const amount = UniversalAmountExtractor.extract(combined);
        const accountLast4 = this.extractAccountLast4(combined);
        const recipientUPI = UPIParser.extractVPA(combined);
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        // Get or create bank account instrument
        let instrumentId: string | undefined = undefined;
        if (accountLast4) {
            const instrument = await InstrumentAutoService.findOrCreateAccount(userId, accountLast4, email);
            instrumentId = instrument.id;
        }

        // Also auto-create UPI handle instrument for counterparty if found
        if (recipientUPI) {
            await InstrumentAutoService.findOrCreateUPI(userId, recipientUPI, email);
        }

        let merchant = this.extractMerchant(combined);
        // Try to derive merchant from VPA if regex failed or returned generic
        if ((!merchant || merchant === 'UPI Merchant') && recipientUPI) {
            const fromVpa = UPIParser.getMerchantFromVPA(recipientUPI);
            if (fromVpa) {
                merchant = fromVpa;
            } else {
                merchant = recipientUPI; // Fallback to VPA itself
            }
        }
        merchant = merchant || 'UPI Merchant';

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant: merchant,
            date: date,
            cardLastFour: accountLast4 || undefined,
            direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_DEBIT,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            counterpartyIdentifier: recipientUPI || undefined,
            instrumentType: InstrumentType.BANK_ACCOUNT,
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
                // Filter out false positives
                if (merchant.length > 2 && !BankParserPatterns.FALSE_MERCHANT.test(merchant)) {
                    // Clean up trailing chars check?
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
