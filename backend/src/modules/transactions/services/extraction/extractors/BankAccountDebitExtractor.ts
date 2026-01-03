import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';
import { BankParserPatterns } from '@shared/utils/cache/regexCache';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { MerchantExtractor } from '../MerchantExtractor';

export class BankAccountDebitExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        const amount = this.extractAmount(combined);
        const accountLast4 = this.extractAccountLast4(combined);
        const recipient = this.extractRecipient(combined, email.subject);
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
            merchant: recipient,
            date: date,
            cardLastFour: accountLast4 || undefined,
            direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.BANK_DEBIT,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant: recipient,
            instrumentType: InstrumentType.BANK_ACCOUNT,
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
        return UniversalAmountExtractor.extract(text);
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

    private static extractRecipient(text: string, subject: string = ''): string {
        // Use the new centralized MerchantExtractor
        const candidates = MerchantExtractor.extract(text, subject);

        if (candidates.length > 0) {
            return candidates[0].rawName;
        }

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
