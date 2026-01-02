import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';
import { BankParserPatterns } from '@shared/utils/cache/regexCache';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

export class CreditCardSpendExtractor {
    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        // Bank Specific Handling
        const patternName = classification?.metadata?.pattern;

        if (patternName === 'SBI_CC_SPEND') {
            return this.extractSBI(userId, email);
        }
        if (patternName === 'JUPITER_CC_SPEND') {
            return this.extractJupiterRuPay(userId, email);
        }
        if (patternName === 'AXIS_CC_SPEND') {
            return this.extractAxis(userId, email);
        }
        if (patternName === 'APPLE_SPEND') {
            return this.extractApple(userId, email);
        }
        if (patternName === 'YES_BANK_SPEND') {
            return this.extractYesBank(userId, email);
        }

        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        // Extract fields
        const amount = this.extractAmount(combined);
        const merchant = this.extractMerchant(combined);
        const cardLast4 = this.extractCardLast4(combined);
        const date = this.extractDate(text, email.internalDate);
        const referenceNumber = this.extractReferenceNumber(combined);

        // Get or create instrument
        let instrumentId: string | undefined = undefined;
        if (cardLast4) {
            const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);
            instrumentId = instrument.id;
        } else {
            // Fallback: Try to find bank and use generic card
            const bank = await InstrumentAutoService.detectBankFromEmail(email);
            if (bank) {
                const instrument = await InstrumentAutoService.findOrCreateGenericCard(userId, bank.name, email);
                instrumentId = instrument.id;
            }
        }

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date: date,
            cardLastFour: cardLast4 || undefined,
            direction: TransactionDirection.DEBIT
        });

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
        return UniversalAmountExtractor.extract(text);
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
        if (/(?:USD|\$)\s*\d+/.test(text)) return 'USD';
        if (/(?:EUR|€)\s*\d+/.test(text)) return 'EUR';
        if (/(?:GBP|£)\s*\d+/.test(text)) return 'GBP';
        if (/(?:SGD|S\$)\s*\d+/.test(text)) return 'SGD';
        if (/(?:AED)\s*\d+/.test(text)) return 'AED';

        // Fallback to INR if strictly INR keywords found, else default
        if (BankParserPatterns.CURRENCY_INR && BankParserPatterns.CURRENCY_INR.test(text)) return 'INR';

        return 'INR'; // Default assumption
    }

    private static async extractSBI(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // Snippet check: Rs.178.45 spent on your SBI Credit Card ending 7603 at ZOMATOLIMITED on 27/12/25
        const regex = /Rs\.(\d+(?:\.\d{2})?)\s+spent\s+on\s+your\s+SBI\s+Credit\s+Card\s+ending\s+(\d{4})\s+at\s+(.*?)\s+on\s+(\d{2}\/\d{2}\/\d{2})/i;

        const match = fullText.match(regex);
        let amount = 0;
        let merchant = 'SBI Merchant';
        let cardLast4 = '';
        let date = new Date(email.internalDate);

        if (match) {
            amount = parseFloat(match[1]);
            cardLast4 = match[2];
            merchant = match[3].trim();
            // Date: 27/12/25
            const dateParts = match[4].split('/');
            if (dateParts.length === 3) {
                // DD/MM/YY
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // JS month 0-11
                const year = 2000 + parseInt(dateParts[2]);
                date = new Date(year, month, day);
            }
        } else {
            // Fallback to generic if regex fails even with high confidence classification
            // (Should ideally rely on generic extractors but scoped)
            amount = this.extractAmount(fullText);
            const genericMerchant = this.extractMerchant(fullText);
            merchant = genericMerchant !== 'Unknown Merchant' ? genericMerchant : 'SBI Generic';
            cardLast4 = this.extractCardLast4(fullText) || '';
        }

        const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);

        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount,
            merchant,
            date,
            cardLastFour: cardLast4,
            direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId: instrument.id,
            category: 'Shopping',
            fingerprint,
            metadata: {
                source: 'SBI_STRICT',
                emailSubject: email.subject
            }
        };
    }

    private static async extractJupiterRuPay(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // You paid ₹120.00 Paid to Flipkart Internet PrivaBANGALORE KAIN Date Dec 26, 2025
        const regex = /You\s+paid\s+(?:₹|Rs\.?)(\d+(?:\.\d{2})?)\s+Paid\s+to\s+(.*?)\s+Date/i;

        const match = fullText.match(regex);
        let amount = 0;
        let merchant = 'Jupiter Merchant';

        if (match) {
            amount = parseFloat(match[1]);
            merchant = match[2].trim();
        } else {
            amount = this.extractAmount(fullText);
            // Jupiter usually has merchant clearly.
        }

        // Jupiter RuPay uses a virtual card mostly, but we can try to find last 4 if present in body (usually not in snippet)
        // snippet: "Issued by | Powered by" ... 
        const cardLast4 = this.extractCardLast4(fullText) || '';

        // For Jupiter, the bank is "Federal Bank" or "CSB Bank" usually backing the card, but "Jupiter" is the brand.
        // We might want to bucket it under Jupiter.
        // findOrCreateGenericCard might be better if no Last4.

        let instrumentId = '';
        if (cardLast4) {
            const inst = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);
            instrumentId = inst.id;
        } else {
            const inst = await InstrumentAutoService.findOrCreateGenericCard(userId, 'Jupiter', email);
            instrumentId = inst.id;
        }

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            category: 'Shopping',
            fingerprint: TransactionDeduplicator.generateFingerprint({ amount, merchant, date: new Date(email.internalDate), direction: TransactionDirection.DEBIT }),
            metadata: {
                source: 'JUPITER_RuPay_STRICT',
                emailSubject: email.subject
            }
        };
    }

    private static async extractAxis(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // Subject: Transaction alert on Axis Bank Credit Card no. XX3825
        // Body (Generic): Transaction of INR 500.00 on Credit Card no. XX3825 at AMAZON on ...
        // We rely on generic extraction for amount/merchant but use specific Card logic.

        let amount = this.extractAmount(fullText);
        let merchant = this.extractMerchant(fullText);
        let cardLast4 = this.extractCardLast4(fullText) || '';

        // Axis often puts Merchant after 'at'
        const merchantMatch = fullText.match(/at\s+([^0-9]+?)\s+on/i);
        if (merchantMatch) merchant = merchantMatch[1].trim();

        // Card Last 4
        const cardMatch = fullText.match(/Credit\s+Card\s+no\.\s+XX(\d{4})/i);
        if (cardMatch) cardLast4 = cardMatch[1];

        const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId: instrument.id,
            category: 'Shopping',
            fingerprint: TransactionDeduplicator.generateFingerprint({ amount, merchant, date: new Date(email.internalDate), cardLastFour: cardLast4, direction: TransactionDirection.DEBIT }),
            metadata: { source: 'AXIS_STRICT', emailSubject: email.subject }
        };
    }

    private static async extractApple(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // Subject: Your invoice from Apple
        // Body: Total ₹149.00

        const amount = this.extractAmount(fullText);
        const merchant = 'Apple Services';

        // This is usually a card transaction but email doesn't mention card details often.
        // It's a receipt.
        const instrument = await InstrumentAutoService.findOrCreateGenericCard(userId, 'Apple', email);

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId: instrument.id,
            category: 'Subscription', // Apple is usually subscription/digital
            fingerprint: TransactionDeduplicator.generateFingerprint({ amount, merchant, date: new Date(email.internalDate), direction: TransactionDirection.DEBIT }),
            metadata: { source: 'APPLE_RECEIPT', emailSubject: email.subject }
        };
    }

    private static async extractYesBank(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');

        // Try generic extraction primarily, just enforcing specific context
        let amount = this.extractAmount(fullText);
        let merchant = this.extractMerchant(fullText);
        let cardLast4 = this.extractCardLast4(fullText) || '';

        // Yes Bank: "INR 230.00 has been debited from your card XX1234"
        const cardMatch = fullText.match(/card\s+(?:ending\s+)?(?:XX)?(\d{4})/i);
        if (cardMatch) cardLast4 = cardMatch[1];

        const instrument = await InstrumentAutoService.findOrCreateCard(userId, 'credit_card', cardLast4, email);

        return {
            type: TransactionType.CREDIT_CARD_SPEND,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId: instrument.id,
            category: 'Shopping',
            fingerprint: TransactionDeduplicator.generateFingerprint({ amount, merchant, date: new Date(email.internalDate), cardLastFour: cardLast4, direction: TransactionDirection.DEBIT }),
            metadata: { source: 'YES_BANK_STRICT', emailSubject: email.subject }
        };
    }
}
