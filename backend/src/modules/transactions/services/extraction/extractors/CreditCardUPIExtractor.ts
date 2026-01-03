import crypto from 'crypto';
import { TransactionDeduplicator } from '../../TransactionDeduplicator';
import { CleanEmail, ExtractedTransaction, TransactionType, TransactionDirection, InstrumentType } from '@shared/types/transaction.types';
import { InstrumentAutoService } from '@modules/cards/instrument-auto.service';
import { BankParserPatterns } from '@shared/utils/cache/regexCache';
import { CurrencyAmountExtractor, ExtractedCurrencyAmount } from '../CurrencyAmountExtractor';
import { currencyConverter } from '@modules/currency/CurrencyConversionService';
import { MerchantExtractor } from '../MerchantExtractor';

export class CreditCardUPIExtractor {
    static async extract(userId: string, email: CleanEmail): Promise<ExtractedTransaction> {
        const text = (email.subject + ' ' + email.cleanedBody).toLowerCase();
        const combined = email.subject + ' ' + email.cleanedBody;

        // Extract amount with currency detection
        const currencyResult = this.extractAmountWithCurrency(combined);
        const amount = currencyResult.normalizedAmount;
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
        const merchant = this.extractMerchant(combined, email.subject) || upiRecipient || 'UPI Merchant';

        // Perform currency conversion if needed (UPI is typically INR)
        const detectedCurrency = currencyResult.detectedCurrency || 'INR';
        const conversion = await currencyConverter.convert(amount, detectedCurrency, 'INR');

        return {
            type: TransactionType.CREDIT_CARD_UPI,
            direction: TransactionDirection.DEBIT,
            amount: currencyResult.isNegative ? -Math.abs(amount) : amount,
            currency: detectedCurrency,
            merchant,
            counterpartyIdentifier: upiRecipient || undefined,
            instrumentType: InstrumentType.CREDIT_CARD,
            instrumentId,
            category: 'UPI',
            referenceNumber: referenceNumber || undefined,
            fingerprint,
            // Currency extraction fields
            rawAmountString: currencyResult.rawAmountString,
            detectedCurrency: currencyResult.detectedCurrency ?? undefined,
            currencyConfidence: currencyResult.currencyConfidence,
            currencyDetectionMethod: currencyResult.detectionMethod,
            // Conversion fields
            convertedAmount: conversion.convertedAmount,
            conversionRate: conversion.conversionRate,
            rateSource: conversion.rateSource,
            rateDate: conversion.rateDate,
            conversionSkipped: conversion.conversionSkipped,
            conversionSkipReason: conversion.skipReason,
            isCrypto: currencyResult.isCrypto,
            currencyAmbiguityFlags: currencyResult.ambiguityFlags,
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

    private static extractAmountWithCurrency(text: string): ExtractedCurrencyAmount {
        try {
            return CurrencyAmountExtractor.extract(text);
        } catch {
            // Fallback to legacy extraction
            const amount = this.extractAmount(text);
            return {
                rawAmountString: amount.toString(),
                normalizedAmount: amount,
                detectedCurrency: 'INR',
                currencyConfidence: 'low',
                isNegative: false,
                isCrypto: false,
                detectionMethod: 'unknown',
                ambiguityFlags: ['Fallback to legacy extraction'],
            };
        }
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

    private static extractMerchant(text: string, subject: string = ''): string | null {
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
