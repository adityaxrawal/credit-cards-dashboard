import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';
import { BankParserPatterns } from '@shared/utils/cache/regexCache';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

export class BankAccountUPICreditExtractor {
    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        // Bank Specific Handling
        const patternName = classification?.metadata?.pattern;

        if (patternName === 'SLICE_UPI') {
            return this.extractSliceUPI(userId, email);
        }

        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();

        const amount = this.extractAmount(text);
        const accountLast4 = this.extractAccountLast4(text);
        const senderUPI = this.extractSenderUPI(text);
        const date = new Date(email.internalDate);
        const referenceNumber = this.extractReferenceNumber(text);

        // Get or create bank account instrument
        let instrumentId: string | undefined = undefined;
        if (accountLast4) {
            const instrument = await InstrumentAutoService.findOrCreateAccount(userId, accountLast4, email);
            instrumentId = instrument.id;
        }

        // Also auto-create UPI handle instrument for counterparty if found
        if (senderUPI) {
            await InstrumentAutoService.findOrCreateUPI(userId, senderUPI, email);
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant: senderUPI || 'UPI Sender',
            date: date,
            cardLastFour: accountLast4 || undefined,
            direction: TransactionDirection.CREDIT
        });

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_CREDIT,
            direction: TransactionDirection.CREDIT,
            amount,
            currency: 'INR',
            merchant: senderUPI || 'UPI Sender', // Or counterparty name if extracted
            counterpartyIdentifier: senderUPI || undefined,
            instrumentType: InstrumentType.BANK_ACCOUNT,
            instrumentId,
            category: 'Income', // Default to Income or Transfer
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            metadata: {
                accountLast4,
                senderUPI,
            }
        };
    }

    private static extractAmount(text: string): number {
        // Use shared pattern which handles ₹, Rs., INR, etc.
        const match = text.match(BankParserPatterns.AMOUNT_INR);
        if (match) return parseFloat(match[1].replace(/,/g, ''));
        throw new Error('Amount not found');
    }

    private static extractAccountLast4(text: string): string | null {
        const match = text.match(/(?:account|a\/c)\s*(?:no\.|xx)?\s*(\d{4})/i);
        return match ? match[1] : null;
    }

    private static extractSenderUPI(text: string): string | null {
        const match = text.match(/from\s+([a-zA-Z0-9._-]+@[a-zA-Z]+)/i);
        return match ? match[1] : null;
    }

    private static extractReferenceNumber(text: string): string | null {
        const match = text.match(/ref(?:erence)?\s*(?:no\.?)?\s*[:]\s*([A-Z0-9]+)/i);
        return match ? match[1] : null;
    }

    private static async extractSliceUPI(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // Format: "Received ₹283 via UPI"
        const regex = /Received\s+(?:₹|Rs\.?)(\d+(?:\.\d{2})?)\s+via\s+UPI/i;

        const match = fullText.match(regex);
        let amount = 0;

        if (match) {
            amount = parseFloat(match[1]);
        } else {
            // Fallback
            amount = this.extractAmount(fullText);
        }

        // Slice usually means it's credited to the Slice account (which is effectively a bank account/wallet)
        // We will create a generic "Slice" instrument.
        const instrument = await InstrumentAutoService.findOrCreateGenericCard(userId, 'Slice', email);

        const merchant = 'UPI Sender';
        // Can try to extract name from body if available, but snippet often short.

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_CREDIT,
            direction: TransactionDirection.CREDIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT,
            instrumentId: instrument.id,
            category: 'Income',
            fingerprint: TransactionDeduplicator.generateFingerprint({ amount, merchant, date: new Date(email.internalDate), direction: TransactionDirection.CREDIT }),
            metadata: {
                source: 'SLICE_UPI_STRICT',
                senderUPI: 'slice-user' // Placeholder
            }
        };
    }
}
