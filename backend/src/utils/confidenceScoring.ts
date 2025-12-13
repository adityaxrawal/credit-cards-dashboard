/**
 * Confidence Scoring System
 * 
 * Implements the 10-level confidence scoring from the architecture spec.
 * Score range: 30-100
 * 
 * Confidence Levels:
 * - 90-100: HIGH - Save directly to database
 * - 70-89:  MEDIUM - Save with review flag
 * - 50-69:  LOW - Send to GPT queue
 * - <50:    VERY_LOW - Send to GPT + mark needs_review
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
    transactionType?: 'PURCHASE' | 'UPI' | 'RECURRING';
    category?: string;
    categorySource: 'keyword' | 'unknown';
}

export interface ConfidenceResult {
    score: number;
    level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
    factors: ConfidenceFactors;
    needsGptReview: boolean;
    needsManualReview: boolean;
}

export interface ConfidenceFactors {
    amountPenalty: number;
    merchantPenalty: number;
    datePenalty: number;
    cardPenalty: number;
    bankPenalty: number;
    categoryPenalty: number;
    transactionTypePenalty: number;
    totalPenalty: number;
}

/**
 * Calculate confidence score based on extraction details
 * Starts at 100, subtracts penalties for uncertainties
 */
export function calculateConfidence(details: ExtractionDetails): ConfidenceResult {
    let penalty = 0;
    const factors: ConfidenceFactors = {
        amountPenalty: 0,
        merchantPenalty: 0,
        datePenalty: 0,
        cardPenalty: 0,
        bankPenalty: 0,
        categoryPenalty: 0,
        transactionTypePenalty: 0,
        totalPenalty: 0,
    };

    // LEVEL 1: Amount extraction
    if (details.amountSource === 'missing') {
        factors.amountPenalty = -40; // Critical - can't be a transaction without amount
    } else if (details.amountSource === 'fallback') {
        factors.amountPenalty = -15;
    }
    penalty += factors.amountPenalty;

    // LEVEL 2: Merchant extraction
    if (!details.merchantFound || !details.merchant || details.merchant === 'UNKNOWN') {
        factors.merchantPenalty = -20;
    }
    penalty += factors.merchantPenalty;

    // LEVEL 3: Date extraction
    if (details.dateSource === 'missing') {
        factors.datePenalty = -10;
    } else if (details.dateSource === 'timestamp') {
        factors.datePenalty = -5; // Using email timestamp as fallback
    }
    penalty += factors.datePenalty;

    // LEVEL 4: Card last 4 digits
    if (!details.cardFound || !details.cardLast4 || details.cardLast4 === '0000') {
        factors.cardPenalty = -30;
    }
    penalty += factors.cardPenalty;

    // LEVEL 5: Bank name
    if (details.bankSource === 'missing') {
        factors.bankPenalty = -10;
    } else if (details.bankSource === 'body') {
        factors.bankPenalty = -5; // Slightly less reliable than sender
    }
    penalty += factors.bankPenalty;

    // LEVEL 6: Transaction type
    if (details.transactionType === 'UPI') {
        factors.transactionTypePenalty = -5; // UPI slightly less reliable extraction
    } else if (details.transactionType === 'RECURRING') {
        factors.transactionTypePenalty = -5;
    }
    penalty += factors.transactionTypePenalty;

    // LEVEL 7: Category
    if (details.categorySource === 'unknown') {
        factors.categoryPenalty = -10;
    }
    penalty += factors.categoryPenalty;

    factors.totalPenalty = penalty;

    // Calculate final score (minimum 30)
    const score = Math.max(30, 100 + penalty);

    // Determine confidence level
    let level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';
    let needsGptReview = false;
    let needsManualReview = false;

    if (score >= 90) {
        level = 'HIGH';
    } else if (score >= 70) {
        level = 'MEDIUM';
        needsManualReview = true; // Save but flag for review
    } else if (score >= 50) {
        level = 'LOW';
        needsGptReview = true;
    } else {
        level = 'VERY_LOW';
        needsGptReview = true;
        needsManualReview = true;
    }

    return {
        score,
        level,
        factors,
        needsGptReview,
        needsManualReview,
    };
}

/**
 * Quick check if extraction should be sent to GPT
 */
export function shouldSendToGpt(score: number): boolean {
    return score < 50;
}

/**
 * Quick check if extraction can be saved directly
 */
export function canSaveDirectly(score: number): boolean {
    return score >= 50;
}

/**
 * Get database status based on confidence level
 */
export function getProcessingStatus(level: 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW'): string {
    switch (level) {
        case 'HIGH':
            return 'success';
        case 'MEDIUM':
            return 'success_needs_review';
        case 'LOW':
            return 'queued_for_gpt';
        case 'VERY_LOW':
            return 'queued_for_gpt_urgent';
    }
}
