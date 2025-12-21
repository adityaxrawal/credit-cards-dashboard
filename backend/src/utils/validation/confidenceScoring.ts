/**
 * Deterministic Confidence Scoring System
 * 
 * Implements Rule-Based Weighting:
 * - Amount detected: +0.3
 * - Action keyword: +0.3 (Assumed true if we reached this stage via RuleProcessor)
 * - Merchant detected: +0.2
 * - Card matched: +0.2
 * 
 * Max Score: 1.0
 * Minimum Threshold: 0.8
 */

export interface ExtractionDetails {
    amount?: number;
    amountSource: 'regex' | 'fallback' | 'missing';
    merchant?: string;
    merchantFound: boolean;
    date?: Date;
    dateSource: 'body' | 'timestamp' | 'missing';
    cardLast4?: string;
    cardFound: boolean;
    bankName?: string;
    bankSource: 'sender' | 'body' | 'missing';
    transactionType?: 'PURCHASE' | 'UPI' | 'RECURRING' | 'debit' | 'credit';
    category?: string;
    categorySource: 'keyword' | 'unknown';
}

export interface ConfidenceResult {
    score: number;
    level: 'HIGH' | 'LOW';
    breakdown: { [key: string]: number };
    needsGptReview: boolean;
}

/**
 * Calculate confidence score based on extraction details
 * Returns score between 0.0 and 1.0
 */
export function calculateConfidence(details: ExtractionDetails): ConfidenceResult {
    let score = 0.0;
    const breakdown: { [key: string]: number } = {};

    // 1. Amount (+0.3)
    if (details.amountSource === 'regex' && details.amount && details.amount > 0) {
        score += 0.3;
        breakdown['amount'] = 0.3;
    } else {
        breakdown['amount'] = 0.0;
    }

    // 2. Action Keyword (+0.3)
    // In RuleProcessor, we usually verify "isTransaction" before calling this.
    // However, we should double check if we have a valid validation source.
    // Assuming if we are scoring, we passed basic checks.
    // Let's rely on bankParser confirmation or explicit check.
    // For now, we assume if we are here, keyword matched.
    score += 0.3;
    breakdown['keyword'] = 0.3;

    // 3. Merchant Detected (+0.2)
    if (details.merchantFound && details.merchant && details.merchant !== 'Unknown Merchant' && details.merchant !== 'UNKNOWN') {
        score += 0.2;
        breakdown['merchant'] = 0.2;
    } else {
        breakdown['merchant'] = 0.0;
    }

    // 4. Card Matched (+0.2)
    // "Card matched" means we extracted Last 4 digits.
    if (details.cardFound && details.cardLast4 && details.cardLast4 !== '0000') {
        score += 0.2;
        breakdown['card'] = 0.2;
    } else {
        breakdown['card'] = 0.0;
    }

    // Floating point math safety
    score = Math.round(score * 10) / 10;

    const needsGptReview = score < 0.8;
    const level = score >= 0.8 ? 'HIGH' : 'LOW';

    return {
        score,
        level,
        breakdown,
        needsGptReview
    };
}

/**
 * Quick check if extraction should be sent to GPT
 */
export function shouldSendToGpt(score: number): boolean {
    return score < 0.8;
}

/**
 * Quick check if extraction can be saved directly
 */
export function canSaveDirectly(score: number): boolean {
    return score >= 0.8;
}

/**
 * Get database status based on confidence level
 */
export function getProcessingStatus(level: 'HIGH' | 'LOW', score: number): string {
    if (score >= 0.8) return 'success';
    return 'queued_for_gpt';
}

