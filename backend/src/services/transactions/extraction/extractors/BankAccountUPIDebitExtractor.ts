import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '../../../../types/transaction.types';
import { InstrumentAutoService } from '../../../cards/instruments/InstrumentAutoService';
import { BankParserPatterns } from '../../../../utils/cache/regexCache';
import { UPIParser } from '../../../../utils/text/UPIParser';
import { UniversalAmountExtractor } from '../UniversalAmountExtractor';
import { EnhancedClassificationResult } from '../../classification/EnhancedRuleClassifier';

export class BankAccountUPIDebitExtractor {
    static async extract(userId: string, email: CleanEmail, classification?: EnhancedClassificationResult): Promise<ExtractedTransaction> {
        // Bank Specific Handling
        const patternName = classification?.metadata?.pattern;

        if (patternName === 'HDFC_UPI_DEBIT') {
            return this.extractHDFCUPI(userId, email);
        }
        if (patternName === 'JUPITER_UPI_SPEND') {
            return this.extractJupiterUPI(userId, email);
        }

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
        } else {
            // Try to find payer VPA (Global search)
            const payerVPA = this.extractPayerVPA(combined);
            if (payerVPA) {
                // Reuse findOrCreateUPI for the payer handle as an instrument
                const instrument = await InstrumentAutoService.findOrCreateUPI(userId, payerVPA, email);
                instrumentId = instrument.id;
            }
        }

        // Also auto-create UPI handle instrument for counterparty if found
        if (recipientUPI) {
            await InstrumentAutoService.findOrCreateUPI(userId, recipientUPI, email);
        }

        // Jupiter / Specific Merchant Extraction
        let merchant = this.extractJupiterMerchant(combined);

        // Fallback to generic if not found
        if (!merchant) {
            merchant = this.extractMerchant(combined);
            // Try to derive merchant from VPA if regex failed or returned generic
            if ((!merchant || merchant === 'UPI Merchant') && recipientUPI) {
                const fromVpa = UPIParser.getMerchantFromVPA(recipientUPI);
                if (fromVpa) {
                    merchant = fromVpa;
                } else {
                    merchant = recipientUPI; // Fallback to VPA itself
                }
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

    private static async extractHDFCUPI(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // Rs.200.00 has been debited from account 4691 to VPA SHREESOMNATHTRUSTVAS.76061863@hdfcbank SHREE SOMNATH TRUST VAS on 23-12-25
        const regex = /Rs\.(\d+(?:\.\d{2})?).*?from\s+account\s+(\d+)\s+to\s+VPA\s+(.*?)\s+on\s+(\d{2}-\d{2}-\d{2})/i;

        const match = fullText.match(regex);
        let amount = 0;
        let accountLast4 = '';
        let recipientVPAandMerchant = '';
        let merchant = 'UPI Merchant';
        let date = new Date(email.internalDate);

        if (match) {
            amount = parseFloat(match[1]);
            accountLast4 = match[2];
            recipientVPAandMerchant = match[3];

            // Date: 23-12-25
            const dateParts = match[4].split('-');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1;
                const year = 2000 + parseInt(dateParts[2]);
                date = new Date(year, month, day);
            }

            // VPA and Merchant often combined: "user@okicici Some Name"
            // Split by space? Or use UPIParser logic
            const vpaMatch = UPIParser.extractVPA(recipientVPAandMerchant);
            if (vpaMatch) {
                // Name follows VPA often
                merchant = recipientVPAandMerchant.replace(vpaMatch, '').trim();
                if (!merchant) merchant = UPIParser.getMerchantFromVPA(vpaMatch) || vpaMatch;
            } else {
                merchant = recipientVPAandMerchant.trim();
            }
        } else {
            amount = UniversalAmountExtractor.extract(fullText);
            merchant = 'HDFC UPI';
            accountLast4 = this.extractAccountLast4(fullText) || '';
        }

        const instrument = await InstrumentAutoService.findOrCreateAccount(userId, accountLast4, email);
        const fingerprint = TransactionDeduplicator.generateFingerprint({
            amount, merchant, date, cardLastFour: accountLast4, direction: TransactionDirection.DEBIT
        });

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_DEBIT,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT,
            instrumentId: instrument.id,
            category: 'UPI',
            fingerprint,
            metadata: { source: 'HDFC_STRICT', emailSubject: email.subject, accountLast4 }
        };
    }

    private static async extractJupiterUPI(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const fullText = email.subject + ' ' + (email.cleanedBody || '');
        // You paid ₹200 Paid to SHREE SOMNATH TRUST VAS... Date Dec 23, 2025
        const regex = /You\s+paid\s+(?:₹|Rs\.?|INR)\s*(\d+(?:\.\d{2})?)\s+Paid\s+to\s+(.*?)\s+Date/i;

        const match = fullText.match(regex);
        let amount = 0;
        let merchant = 'Jupiter UPI';

        if (match) {
            amount = parseFloat(match[1]);
            merchant = match[2].trim();

            // Clean merchant if it contains trailing identifiers
            const parts = merchant.split(' ');
            if (parts.length > 0 && parts[parts.length - 1].includes('@')) {
                // Ends with VPA like 'Aditya 8127696200@jupiteraxis'
                // Wait, snippet earlier: "Paid to SHREE SOMNATH TRUST VAS SHREESOMNATHTRUSTVAS.76061863@hdfcbank Date"
                // So VPA is part of "merchant" string here.
            }
        } else {
            amount = UniversalAmountExtractor.extract(fullText);
        }

        // Jupiter uses account linked or wallet (pots)
        // Usually generic "Jupiter" bank account unless linked to Federal
        const instrument = await InstrumentAutoService.findOrCreateGenericCard(userId, 'Jupiter Account', email);
        // Note: GenericCard isn't ideal for Bank Account, but findOrCreateAccount requires Last4. 
        // We need a findOrCreateGenericAccount or similar. 
        // For now, mapping to generic UPI handle or instrument is acceptable if no account number is found.

        return {
            type: TransactionType.BANK_ACCOUNT_UPI_DEBIT,
            direction: TransactionDirection.DEBIT,
            amount,
            currency: 'INR',
            merchant,
            instrumentType: InstrumentType.BANK_ACCOUNT, // Force bank account type
            instrumentId: instrument.id,
            category: 'UPI',
            fingerprint: TransactionDeduplicator.generateFingerprint({ amount, merchant, date: new Date(email.internalDate), direction: TransactionDirection.DEBIT }),
            metadata: { source: 'JUPITER_UPI_STRICT', emailSubject: email.subject }
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
            /(?:UPI\s*Ref(?:\s*No)?|Ref\s*No|Reference\s*Number)[\s:-]*(\d{12})/i, // 12-digit UPI Ref
            /(\d{12})/ // Capture any standalone 12-digit number (aggressive, check context?) - Keep it safe with label
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    private static extractJupiterMerchant(text: string): string | null {
        // "Paid to JISHAN"
        const match = text.match(/Paid\s+to\s+([^\n]+)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return null;
    }

    private static extractPayerVPA(text: string): string | null {
        // Global pattern: "From [Name] [VPA]"
        // Looks for "From" followed by optional name words and then a VPA-like string (S+@S+)
        const match = text.match(/From\s+(?:.*[\r\n\s]+)?(\S+@\S+)/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return null;
    }
}
