import { TransactionType } from '../../../types/transaction.types';

/**
 * Transaction direction
 */
export type Direction = 'debit' | 'credit';

export interface DirectionResult {
    direction: Direction;
    confidence: number;
    reason: string;
}

/**
 * DirectionInferencer - Automatically determine if a transaction is debit or credit
 */
export class DirectionInferencer {
    /**
     * Infer transaction direction from type and email content
     */
    static infer(
        transactionType: string,
        emailContent?: { subject: string; snippet?: string; cleanedBody?: string }
    ): DirectionResult {
        // 1. First check based on transaction type
        const typeBasedResult = this.inferFromType(transactionType);
        if (typeBasedResult.confidence >= 0.9) {
            return typeBasedResult;
        }

        // 2. If uncertain, check email content
        if (emailContent) {
            const textBasedResult = this.inferFromText(
                `${emailContent.subject} ${emailContent.snippet || ''} ${emailContent.cleanedBody || ''}`
            );

            // If text gives high confidence, use it
            if (textBasedResult.confidence >= 0.8) {
                return textBasedResult;
            }

            // Combine type and text results
            if (typeBasedResult.direction === textBasedResult.direction) {
                return {
                    direction: typeBasedResult.direction,
                    confidence: Math.min(typeBasedResult.confidence + 0.1, 1.0),
                    reason: `${typeBasedResult.reason} + ${textBasedResult.reason}`
                };
            }
        }

        // 3. Return type-based result as fallback
        return typeBasedResult;
    }

    /**
     * Infer direction from transaction type
     */
    private static inferFromType(transactionType: string): DirectionResult {
        const type = transactionType.toLowerCase();

        // Definite debit types
        const debitTypes = [
            'cc_spend', 'credit_card_spend',
            'bank_debit',
            'bank_upi_debit', 'upi_debit',
            'cc_upi', 'credit_card_upi',
            'payment', 'purchase',
            'bill_payment',
            'subscription',
            'emi_payment', 'emi',
            'withdrawal', 'atm',
            'fee', 'charge', 'tax',
        ];

        // Definite credit types
        const creditTypes = [
            'bank_credit',
            'bank_upi_credit', 'upi_credit',
            'salary',
            'refund', 'refund_reversal',
            'cashback',
            'reversal', 'chargeback',
            'reward', 'reward_redemption',
            'deposit',
            'income',
            'credit',
        ];

        // Ambiguous types
        const ambiguousTypes = [
            'unclassified',
            'statement_txn',
            'unknown',
        ];

        for (const debitType of debitTypes) {
            if (type.includes(debitType)) {
                return {
                    direction: 'debit',
                    confidence: 0.95,
                    reason: `Transaction type "${transactionType}" is a debit type`
                };
            }
        }

        for (const creditType of creditTypes) {
            if (type.includes(creditType)) {
                return {
                    direction: 'credit',
                    confidence: 0.95,
                    reason: `Transaction type "${transactionType}" is a credit type`
                };
            }
        }

        // Default to debit for unknown types (most common)
        return {
            direction: 'debit',
            confidence: 0.5,
            reason: `Unknown type "${transactionType}", defaulting to debit`
        };
    }

    /**
     * Infer direction from email text
     */
    private static inferFromText(text: string): DirectionResult {
        const lowerText = text.toLowerCase();

        // Strong debit indicators
        const debitPatterns = [
            { pattern: /(?:debited|deducted|charged|spent|paid|withdrawn)\s+(?:from|via)/i, confidence: 0.95 },
            { pattern: /payment\s+(?:successful|confirmed|processed)/i, confidence: 0.9 },
            { pattern: /purchase\s+(?:of|at|from)/i, confidence: 0.9 },
            { pattern: /(?:you|your)\s+(?:spent|paid|purchased)/i, confidence: 0.85 },
            { pattern: /transaction\s+debited/i, confidence: 0.9 },
            { pattern: /atm\s+withdrawal/i, confidence: 0.95 },
        ];

        // Strong credit indicators
        const creditPatterns = [
            { pattern: /(?:credited|received|deposited)\s+(?:to|in)/i, confidence: 0.95 },
            { pattern: /refund\s+(?:of|for|processed)/i, confidence: 0.95 },
            { pattern: /cashback\s+(?:of|credited)/i, confidence: 0.95 },
            { pattern: /salary\s+(?:credited|deposited)/i, confidence: 0.95 },
            { pattern: /(?:you|your)\s+(?:received|got)/i, confidence: 0.85 },
            { pattern: /reversal\s+(?:of|for)/i, confidence: 0.9 },
            { pattern: /amount\s+credited/i, confidence: 0.9 },
        ];

        // Check debit patterns
        for (const { pattern, confidence } of debitPatterns) {
            if (pattern.test(lowerText)) {
                return {
                    direction: 'debit',
                    confidence,
                    reason: 'Matched debit pattern in text'
                };
            }
        }

        // Check credit patterns
        for (const { pattern, confidence } of creditPatterns) {
            if (pattern.test(lowerText)) {
                return {
                    direction: 'credit',
                    confidence,
                    reason: 'Matched credit pattern in text'
                };
            }
        }

        // Weak indicators (word presence)
        const debitWords = ['spent', 'paid', 'debited', 'charged', 'deducted', 'withdrawn', 'purchase'];
        const creditWords = ['credited', 'received', 'refund', 'cashback', 'deposit', 'salary', 'income'];

        let debitScore = 0;
        let creditScore = 0;

        for (const word of debitWords) {
            if (lowerText.includes(word)) debitScore++;
        }
        for (const word of creditWords) {
            if (lowerText.includes(word)) creditScore++;
        }

        if (debitScore > creditScore) {
            return {
                direction: 'debit',
                confidence: Math.min(0.5 + (debitScore - creditScore) * 0.1, 0.8),
                reason: `Debit words (${debitScore}) > Credit words (${creditScore})`
            };
        }

        if (creditScore > debitScore) {
            return {
                direction: 'credit',
                confidence: Math.min(0.5 + (creditScore - debitScore) * 0.1, 0.8),
                reason: `Credit words (${creditScore}) > Debit words (${debitScore})`
            };
        }

        // Default to debit with low confidence
        return {
            direction: 'debit',
            confidence: 0.4,
            reason: 'No clear direction indicators, defaulting to debit'
        };
    }

    /**
     * Infer direction from amount sign (if available)
     * Negative = debit, Positive = credit
     */
    static inferFromAmount(amount: number): DirectionResult | null {
        if (amount === 0) return null;

        if (amount < 0) {
            return {
                direction: 'debit',
                confidence: 0.99,
                reason: 'Negative amount indicates debit'
            };
        }

        // Positive amounts are ambiguous - could be either
        return null;
    }
}
