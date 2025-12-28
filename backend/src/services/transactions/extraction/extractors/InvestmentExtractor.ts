import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { InstrumentAutoService } from '../../../cards/instruments/InstrumentAutoService';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';

export class InvestmentExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        // Use Universal Extractor for robust amount detection
        const amount = UniversalAmountExtractor.extract(combined);

        // Investment specific logic for merchant/entity
        const merchant = this.extractEntity(combined);

        // Date
        const date = new Date(email.internalDate);

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date,
            direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.INVESTMENT,
            direction: TransactionDirection.DEBIT, // Investments are usually debits from bank
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT, // Usually funded from bank
            category: 'Investment',
            fingerprint,
            metadata: {
                extractedAt: new Date().toISOString(),
                emailSubject: email.subject
            }
        };
    }

    private static extractEntity(text: string): string {
        // Try to find investment platform or fund house
        const platforms = ['Zerodha', 'Groww', 'Upstox', 'Kuvera', 'Coin', 'Smallcase', 'IndMoney', 'Paytm Money'];
        for (const p of platforms) {
            if (text.toLowerCase().includes(p.toLowerCase())) return p;
        }

        // Fallback to extraction patterns
        const match = text.match(/(?:sip|fund|investment)\s+(?:to|with|in)\s+([A-Za-z0-9\s]+)/i);
        if (match && match[1]) return match[1].trim();

        return 'Investment';
    }
}
