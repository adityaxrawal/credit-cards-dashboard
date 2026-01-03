import { CleanEmail } from '@shared/types/transaction.types';
import { TRANSACTION_PATTERNS, isKnownBankSender, PatternGroup, GLOBAL_EXCLUSIONS } from '../../../../data/transaction-patterns';
import logger from '@shared/utils/infrastructure/logger';

/**
 * Result from the enhanced rule classifier
 * Uses string type to allow both TransactionType values and special values like 'non_financial'
 */
export interface EnhancedClassificationResult {
    type: string;
    confidence: number;
    metadata?: Record<string, any>;
}

interface PatternMatchResult {
    category: string;
    score: number;
    matchedKeywords: number;
    totalKeywords: number;
    isTransaction: boolean;
    transactionType?: string;
    direction?: 'debit' | 'credit';
    priority: number;
}

/**
 * Enhanced Rule-Based Classifier
 * 
 * Uses weighted pattern matching with priority-based scoring to classify
 * financial emails with high accuracy. Replaces simple regex matching
 * with a comprehensive pattern database.
 */
export class EnhancedRuleClassifier {
    private static readonly MINIMUM_CONFIDENCE = 0.5;
    private static readonly BANK_SENDER_BONUS = 0.15;

    /**
     * Check if email matches any exclusion patterns (High Priority)
     */
    static checkExclusions(cleanEmail: CleanEmail): { isExcluded: boolean; matchedPattern?: string } {
        const fullText = `${cleanEmail.subject} ${cleanEmail.cleanedBody}`.toLowerCase();

        // 1. Check Global Exclusions (OTP, Login Alert, etc)
        for (const pattern of GLOBAL_EXCLUSIONS) {
            if (pattern.test(fullText)) {
                return { isExcluded: true, matchedPattern: 'global_exclusion' };
            }
        }

        // 2. Check explicitly defined exclusions in patterns (like OTP_EXCLUSION)
        for (const [category, pattern] of Object.entries(TRANSACTION_PATTERNS)) {
            if (pattern.isTransaction === false && pattern.transactionType === 'non_financial') {
                // This is a rejection group
                const result = this.scorePattern(category, pattern, fullText);
                if (result && result.score > 0.8) {
                    return { isExcluded: true, matchedPattern: category };
                }
            }
        }
        return { isExcluded: false };
    }

    static checkFinancialUnknown(cleanEmail: CleanEmail): EnhancedClassificationResult | null {
        const fullText = `${cleanEmail.subject} ${cleanEmail.cleanedBody}`.toLowerCase();

        // Use the existing quick check from isLikelyFinancial but simpler
        // If it looks financial but didn't match any specific category
        const check = this.isLikelyFinancial(fullText);
        if (check.isFinancial && check.confidence > 0.6) {
            return {
                type: 'unclassified',
                confidence: check.confidence,
                metadata: {
                    reason: check.reason,
                    pattern: 'financial_unknown'
                }
            };
        }
        return null;
    }

    /**
     * Classify an email using rule-based pattern matching
     */
    static classify(cleanEmail: CleanEmail): EnhancedClassificationResult | null {
        const fullText = `${cleanEmail.subject} ${cleanEmail.cleanedBody}`.toLowerCase();
        const senderCheck = isKnownBankSender(cleanEmail.from);

        // Score all pattern categories
        const matches: PatternMatchResult[] = [];

        for (const [category, pattern] of Object.entries(TRANSACTION_PATTERNS)) {
            const result = this.scorePattern(category, pattern, fullText);
            if (result && result.score > 0) {
                matches.push(result);
            }
        }

        // Sort by score (highest first)
        // Sort by score (highest first), then by priority
        matches.sort((a, b) => {
            if (Math.abs(b.score - a.score) > 0.0001) {
                return b.score - a.score;
            }
            return b.priority - a.priority;
        });

        // Log match results for debugging
        if (matches.length > 0) {
            logger.debug('[EnhancedRuleClassifier] Pattern matches:', {
                emailId: cleanEmail.id,
                topMatches: matches.slice(0, 3).map(m => ({
                    category: m.category,
                    score: m.score.toFixed(3),
                    keywords: `${m.matchedKeywords}/${m.totalKeywords}`
                }))
            });
        }

        // Check if best match is good enough
        const bestMatch = matches[0];
        if (!bestMatch || bestMatch.score < this.MINIMUM_CONFIDENCE) {
            // Fallback: If no specific category matched, checking if generic financial
            // This prevents "null" which leads to GPT abuse, or "non-financial" misclassification
            return this.checkFinancialUnknown(cleanEmail);
        }

        // Apply bank sender bonus
        let confidence = bestMatch.score;
        if (senderCheck.isKnown) {
            confidence = Math.min(confidence + this.BANK_SENDER_BONUS, 1.0);
            logger.debug('[EnhancedRuleClassifier] Bank sender bonus applied:', {
                bank: senderCheck.bankName,
                newConfidence: confidence.toFixed(3)
            });
        }

        // If it's not a transaction pattern, return null to indicate non-financial
        if (!bestMatch.isTransaction) {
            return {
                type: 'non_financial',
                confidence,
                metadata: {
                    pattern: bestMatch.category,
                    reason: `Matched non-transaction pattern: ${bestMatch.category}`
                }
            };
        }

        // Map to transaction type
        const transactionType = this.mapCategoryToType(bestMatch.category, bestMatch.transactionType);

        return {
            type: transactionType,
            confidence,
            metadata: {
                pattern: bestMatch.category,
                direction: bestMatch.direction,
                matchedKeywords: bestMatch.matchedKeywords,
                isFromKnownBank: senderCheck.isKnown,
                bankName: senderCheck.bankName
            }
        };
    }

    /**
     * Score a pattern against the email text
     */
    private static scorePattern(
        category: string,
        pattern: PatternGroup,
        text: string
    ): PatternMatchResult | null {
        // Check exclude patterns first
        if (pattern.excludePatterns) {
            const hasExclusion = pattern.excludePatterns.some(ep => ep.test(text));
            if (hasExclusion) {
                return null;
            }
        }

        // Count keyword matches and calculate weighted score
        let matchedWeight = 0;
        let matchedCount = 0;
        let maxSingleWeight = 0;

        for (const keyword of pattern.keywords) {
            if (keyword.pattern.test(text)) {
                matchedWeight += keyword.weight;
                matchedCount++;
                maxSingleWeight = Math.max(maxSingleWeight, keyword.weight);
            }
        }

        if (matchedCount === 0) {
            return null;
        }

        // Calculate final score
        // Formula: (matched_weight / matched_count) * (priority / 10)
        let avgWeight = matchedWeight / matchedCount;
        let priorityFactor = pattern.priority / 10;

        // --- OVER-CLASSIFICATION FIX ---
        // If we have High Priority (>10 aka >1.0 factor) but only 1 keyword matched,
        // and that keyword wasn't a "perfect" 1.0 match (like a specific ID/Amount),
        // we damp the priority factor to 1.0 to prevent weak signals from dominating.
        if (pattern.priority > 10 && matchedCount === 1 && maxSingleWeight < 1.0) {
            priorityFactor = 1.0;
        }

        // Base score
        let score = avgWeight * priorityFactor;

        // Boost score if multiple keywords matched (more reliable)
        if (matchedCount >= 2) {
            score *= 1.1;
        }
        if (matchedCount >= 3) {
            score *= 1.05;
        }

        // Cap at 1.0
        score = Math.min(score, 1.0);

        return {
            category,
            score,
            matchedKeywords: matchedCount,
            totalKeywords: pattern.keywords.length,
            isTransaction: pattern.isTransaction,
            transactionType: pattern.transactionType,
            direction: pattern.direction,
            priority: pattern.priority
        };
    }

    /**
     * Map pattern category to standard transaction type
     */
    private static mapCategoryToType(category: string, defaultType?: string): string {
        if (defaultType) {
            return defaultType;
        }

        const typeMap: Record<string, string> = {
            PAYMENT_CONFIRMATION: 'cc_spend',
            DEBIT_ALERT: 'bank_debit',
            CREDIT_ALERT: 'bank_credit',
            UPI_DEBIT: 'bank_upi_debit',
            UPI_CREDIT: 'bank_upi_credit',
            REFUND: 'refund',
            BILL_PAYMENT: 'bank_debit',
            SUBSCRIPTION: 'cc_spend',
            EMI_PAYMENT: 'cc_spend',
            CASHBACK_REWARD: 'cashback',
            STATEMENT: 'statement_txn',

            // New Categories
            INVESTMENT: 'investment',
            TRAVEL: 'travel',
            FOOD_DELIVERY: 'food',
            RIDE_HAILING: 'transport',

            OTP_SECURITY: 'non_financial',
            PROMOTIONAL: 'non_financial',
            MARKETING: 'non_financial',
        };

        return typeMap[category] || 'unclassified';
    }

    // Precompiled regexes for isLikelyFinancial
    private static readonly QUICK_REJECTION_PATTERNS = [
        /unsubscribe|email\s+preferences/i,
        /newsletter|blog|news\s+update/i,
        /password\s+reset|confirm.*(?:email|account)/i,
    ];

    private static readonly FINANCIAL_INDICATORS_PATTERNS = [
        /[₹Rs.INR]\s*[\d,]+/i,  // Currency amounts
        /(?:debited|credited|withdrawn|deposited)/i,
        /(?:payment|transaction|transfer)\s+(?:of|for|successful)/i,
        /(?:credit|debit)\s+card.*(?:used|charged|ended)/i,
        /upi|neft|imps|rtgs/i,
        /(?:bank|savings|current)\s+(?:account|a\/c)/i,
    ];

    /**
     * Quick check if email is likely financial (for use in broad detection)
     */
    static isLikelyFinancial(text: string): { isFinancial: boolean; confidence: number; reason?: string } {
        const lowerText = text.toLowerCase();

        for (const pattern of this.QUICK_REJECTION_PATTERNS) {
            if (pattern.test(lowerText)) {
                return { isFinancial: false, confidence: 0.9, reason: 'Matched rejection pattern' };
            }
        }

        let matchCount = 0;
        for (const pattern of this.FINANCIAL_INDICATORS_PATTERNS) {
            if (pattern.test(lowerText)) {
                matchCount++;
            }
        }

        if (matchCount >= 2) {
            return {
                isFinancial: true,
                confidence: Math.min(0.7 + (matchCount * 0.1), 0.95),
                reason: `Matched ${matchCount} financial indicators`
            };
        }

        if (matchCount === 1) {
            return {
                isFinancial: true,
                confidence: 0.5,
                reason: 'Matched 1 financial indicator'
            };
        }

        return { isFinancial: false, confidence: 0.6, reason: 'No financial indicators' };
    }
}
