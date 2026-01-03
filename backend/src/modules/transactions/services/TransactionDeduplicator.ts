import crypto from 'crypto';
import { isUniqueViolationError } from '@shared/utils/validation/errorTypeGuards';
import logger from '@shared/utils/infrastructure/logger';
import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';

/**
 * Transaction fingerprint components
 */
export interface FingerprintComponents {
    amount: number;
    merchant: string;
    date: Date | string;
    cardLastFour?: string;
    bankDomain?: string;
    direction?: 'debit' | 'credit';

    // New fields for Fix #1
    rrn?: string;
    arn?: string;
    upiRef?: string;
    impsRef?: string;
    walletTxnId?: string;

    // Multi-currency support (Fix #8)
    originalAmount?: number;
    originalCurrency?: string;
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
    fingerprint: string;
    isDuplicate: boolean;
    existingTransactionId?: string;
    confidence: number;
    matchType?: 'PRIMARY_REF' | 'EXACT_FINGERPRINT' | 'SOFT_MATCH' | 'NONE';
}

/**
 * TransactionDeduplicator - Prevent duplicate transaction entries
 * 
 * Uses multi-stage deduplication:
 * 1. Primary References (RRN, ARN, UPI Ref) - 100% confidence
 * 2. Exact Fingerprint Match - 100% confidence
 * 3. Soft Match (Fuzzy) - High confidence
 */
export class TransactionDeduplicator {
    /**
     * Generate a unique fingerprint for a transaction
     */
    static generateFingerprint(components: FingerprintComponents): string {
        const normalized = {
            amount: components.amount.toFixed(2),
            merchant: this.normalizeMerchant(components.merchant),
            date: this.normalizeDate(components.date),
            cardLastFour: components.cardLastFour?.slice(-4) || 'xxxx',
            bankDomain: components.bankDomain?.toLowerCase().split('@')[1]?.split('.')[0] || 'unknown',
            direction: components.direction || 'unknown',
            rrn: components.rrn || '',
            arn: components.arn || '',
            upiRef: components.upiRef || '',
            originalAmount: components.originalAmount ? components.originalAmount.toFixed(2) : '',
            originalCurrency: components.originalCurrency || ''
        };

        const fingerprintString = [
            normalized.amount,
            normalized.merchant,
            normalized.date,
            normalized.cardLastFour,
            normalized.bankDomain,
            normalized.direction,
            normalized.rrn,
            normalized.arn,
            normalized.upiRef,
            normalized.originalAmount,
            normalized.originalCurrency
        ].join('|');

        return crypto.createHash('sha256').update(fingerprintString).digest('hex');
    }

    /**
     * Normalize merchant name for consistent fingerprinting
     */
    private static normalizeMerchant(merchant: string): string {
        if (!merchant) return 'unknown';

        let normalized = merchant.toLowerCase().trim();

        // Remove common suffixes/prefixes
        const noiseWords = ['pvt', 'ltd', 'limited', 'private', 'inc', 'corp', 'llp', 'upi', 'imps', 'neft', 'rtgs', 'slash'];
        noiseWords.forEach(word => {
            normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
        });

        return normalized
            .replace(/[^a-z0-9]/g, '') // Remove special chars
            .replace(/\s+/g, '')
            .substring(0, 50); // Cap length
    }

    /**
     * Normalize date to YYYY-MM-DD format
     */
    private static normalizeDate(date: Date | string): string {
        if (!date) return '1970-01-01';

        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '1970-01-01';

        return d.toISOString().split('T')[0];
    }

    /**
     * Check if a transaction with this fingerprint already exists
     */
    static async checkDuplicate(
        userId: string,
        fingerprint: string,
        components?: FingerprintComponents
    ): Promise<DeduplicationResult> {
        try {
            // STEP 1: Check Primary References (RRN/ARN) - Fix #1
            if (components) {
                const refMatch = await TransactionRepository.findByReference(userId, {
                    rrn: components.rrn,
                    arn: components.arn,
                    upiRef: components.upiRef,
                    impsRef: components.impsRef
                });

                if (refMatch) {
                    logger.info('[Deduplicator] Found duplicate via Primary Reference', {
                        rrn: components.rrn,
                        existingId: refMatch.id
                    });
                    return {
                        fingerprint,
                        isDuplicate: true,
                        existingTransactionId: refMatch.id,
                        confidence: 1.0,
                        matchType: 'PRIMARY_REF'
                    };
                }
            }

            // STEP 2: Check Exact Fingerprint
            const existing = await TransactionRepository.findByFingerprint(userId, fingerprint);

            if (existing) {
                return {
                    fingerprint,
                    isDuplicate: true,
                    existingTransactionId: existing.id,
                    confidence: 1.0,
                    matchType: 'EXACT_FINGERPRINT'
                };
            }

            // STEP 3: Check Soft Dedupe (if components provided)
            if (components) {
                const softMatch = await this.checkNearDuplicate(userId, components);
                if (softMatch.isNearDuplicate && softMatch.matchedIds.length > 0) {
                    return {
                        fingerprint,
                        isDuplicate: true,
                        existingTransactionId: softMatch.matchedIds[0],
                        confidence: softMatch.confidence,
                        matchType: 'SOFT_MATCH'
                    };
                }
            }

            return {
                fingerprint,
                isDuplicate: false,
                confidence: 0,
                matchType: 'NONE'
            };
        } catch (error) {
            logger.error('[Deduplicator] Failed to check duplicate:', error);
            // On error, assume not duplicate to avoid losing transactions
            return {
                fingerprint,
                isDuplicate: false,
                confidence: 0,
                matchType: 'NONE'
            };
        }
    }

    /**
     * Check for near-duplicate transactions (same amount, date, similar merchant)
     * Used when fingerprint doesn't match but transaction might still be duplicate
     */
    static async checkNearDuplicate(
        userId: string,
        components: FingerprintComponents,
        toleranceMs: number = 86400000 * 3 // 3 days tolerance (Fix #6)
    ): Promise<{ isNearDuplicate: boolean; matchedIds: string[]; confidence: number }> {
        try {
            const dateStart = new Date(
                (components.date instanceof Date ? components.date : new Date(components.date)).getTime() - toleranceMs
            );
            const dateEnd = new Date(
                (components.date instanceof Date ? components.date : new Date(components.date)).getTime() + toleranceMs
            );

            const amountMin = components.amount - 0.01;
            const amountMax = components.amount + 0.01;

            const potentialDuplicates = await TransactionRepository.findPotentialDuplicates(
                userId,
                amountMin,
                amountMax,
                dateStart,
                dateEnd
            );

            if (potentialDuplicates.length === 0) {
                return { isNearDuplicate: false, matchedIds: [], confidence: 0 };
            }

            // Check merchant similarity
            const normalizedMerchant = this.normalizeMerchant(components.merchant);
            const matches = potentialDuplicates.filter(row => {
                const rowMerchant = this.normalizeMerchant(row.merchant);
                return this.merchantSimilarity(normalizedMerchant, rowMerchant) > 0.85; // Stricter threshold for auto-dedupe
            });

            // Special check: If amount is same, date is close, merchant matches -> likely duplicate
            // We return confidence based on these factors

            if (matches.length > 0) {
                return {
                    isNearDuplicate: true,
                    matchedIds: matches.map(m => m.id),
                    confidence: 0.9 // High confidence for soft match
                };
            }

            return { isNearDuplicate: false, matchedIds: [], confidence: 0 };
        } catch (error) {
            logger.error('[Deduplicator] Failed to check near-duplicate:', error);
            return { isNearDuplicate: false, matchedIds: [], confidence: 0 };
        }
    }

    /**
     * Calculate merchant name similarity (0-1)
     */
    private static merchantSimilarity(a: string, b: string): number {
        if (a === b) return 1.0;
        if (!a || !b) return 0;

        // Check if one contains the other
        if (a.includes(b) || b.includes(a)) {
            return 0.9;
        }

        // Simple Levenshtein-based similarity
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0) return 1.0;

        const distance = this.levenshtein(a, b);
        return 1 - (distance / maxLen);
    }

    /**
     * Levenshtein distance for string comparison
     */
    private static levenshtein(a: string, b: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Get or create transaction with upsert logic
     * Returns the transaction ID and whether it was newly created
     */
    static async getOrCreate(
        userId: string,
        fingerprint: string,
        components: FingerprintComponents,
        createFn: () => Promise<string | null>
    ): Promise<{ transactionId: string | null; isNew: boolean; mergeStrategy?: string }> {
        // First check if exists
        const existing = await this.checkDuplicate(userId, fingerprint, components);

        if (existing.isDuplicate) {
            logger.info('[Deduplicator] Found existing transaction:', {
                fingerprint: fingerprint.substring(0, 16),
                existingId: existing.existingTransactionId,
                strategy: existing.matchType
            });
            return {
                transactionId: existing.existingTransactionId || null,
                isNew: false,
                mergeStrategy: existing.matchType
            };
        }

        // Create new transaction
        try {
            const newId = await createFn();
            return {
                transactionId: newId,
                isNew: newId !== null
            };
        } catch (error) {
            // Check if this was a duplicate constraint error
            if (isUniqueViolationError(error)) {
                logger.debug('[Deduplicator] Concurrent duplicate detected, fetching existing');
                const retryCheck = await this.checkDuplicate(userId, fingerprint, components);
                return {
                    transactionId: retryCheck.existingTransactionId || null,
                    isNew: false
                };
            }
            throw error;
        }
    }

    /**
     * Compute fingerprints for existing transactions that don't have them
     * (Migration helper)
     */
    static async backfillFingerprints(userId: string, batchSize: number = 100): Promise<number> {
        let updated = 0;
        let hasMore = true;

        while (hasMore) {
            const batch = await TransactionRepository.getFingerprintCandidates(userId, batchSize);

            if (batch.length === 0) {
                hasMore = false;
                break;
            }

            for (const row of batch) {
                const fingerprint = this.generateFingerprint({
                    amount: Number(row.amount),
                    merchant: row.merchant,
                    date: row.transaction_date,
                    bankDomain: row.email_sender || undefined, // Mapping from record to components
                    direction: row.direction as 'debit' | 'credit' | undefined,
                    // TODO: Extract RRN from metadata/description if possible during backfill
                });

                await TransactionRepository.updateFingerprint(row.id, fingerprint);
                updated++;
            }

            logger.info(`[Deduplicator] Backfilled ${updated} fingerprints for user ${userId}`);
        }

        return updated;
    }

    // ============================================
    // TRANSACTION LINKING METHODS
    // ============================================

    /**
     * Find potential refund match for a credit transaction
     * Looks for original debit within configurable window
     */
    static async findRefundMatch(
        userId: string,
        amount: number,
        merchant: string,
        refundDate: Date,
        windowDays: number = 90
    ): Promise<{ originalTransactionId: string | null; confidence: number }> {
        try {
            const windowStart = new Date(refundDate.getTime() - windowDays * 24 * 60 * 60 * 1000);
            const normalizedMerchant = this.normalizeMerchant(merchant);

            const potentialRefunds = await TransactionRepository.findPotentialRefunds(
                userId,
                amount,
                windowStart,
                refundDate
            );

            for (const row of potentialRefunds) {
                const similarity = this.merchantSimilarity(normalizedMerchant, this.normalizeMerchant(row.merchant));
                if (similarity > 0.6) {
                    return { originalTransactionId: row.id, confidence: similarity };
                }
            }

            return { originalTransactionId: null, confidence: 0 };
        } catch (error) {
            logger.error('[Deduplicator] Failed to find refund match:', error);
            return { originalTransactionId: null, confidence: 0 };
        }
    }

    /**
     * Find potential authorization for a settlement transaction
     */
    static async findAuthorizationMatch(
        userId: string,
        amount: number,
        merchant: string,
        settlementDate: Date,
        amountTolerance: number = 0.01  // 1% tolerance for FX
    ): Promise<{ authTransactionId: string | null; confidence: number }> {
        try {
            const windowStart = new Date(settlementDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
            const amountMin = amount * (1 - amountTolerance);
            const amountMax = amount * (1 + amountTolerance);
            const normalizedMerchant = this.normalizeMerchant(merchant);

            const potentialAuths = await TransactionRepository.findPotentialAuths(
                userId,
                amountMin,
                amountMax,
                windowStart,
                settlementDate
            );

            for (const row of potentialAuths) {
                const similarity = this.merchantSimilarity(normalizedMerchant, this.normalizeMerchant(row.merchant));
                if (similarity > 0.7) {
                    return { authTransactionId: row.id, confidence: similarity };
                }
            }

            return { authTransactionId: null, confidence: 0 };
        } catch (error) {
            logger.error('[Deduplicator] Failed to find auth match:', error);
            return { authTransactionId: null, confidence: 0 };
        }
    }

    /**
     * Link two transactions together
     */
    static async linkTransactions(
        transactionId: string,
        linkedTransactionId: string,
        linkType: 'refund' | 'settlement' | 'partial_refund' | 'split' | 'authorization' | 'reversal'
    ): Promise<boolean> {
        try {
            return await TransactionRepository.linkTransaction(transactionId, linkedTransactionId, linkType);
        } catch (error) {
            logger.error('[Deduplicator] Failed to link transactions:', error);
            return false;
        }
    }

    /**
     * Check for partial refund scenario (multiple refunds summing to original)
     */
    static async checkPartialRefunds(
        userId: string,
        originalTransactionId: string
    ): Promise<{ refundIds: string[]; totalRefunded: number; remainingAmount: number }> {
        try {
            const original = await TransactionRepository.findById(userId, originalTransactionId);

            if (!original) {
                return { refundIds: [], totalRefunded: 0, remainingAmount: 0 };
            }

            const originalAmount = Number(original.amount);

            const refunds = await TransactionRepository.getRefundingTransactions(userId, originalTransactionId);

            const refundIds = refunds.map(r => r.id);
            const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

            return {
                refundIds,
                totalRefunded,
                remainingAmount: originalAmount - totalRefunded
            };
        } catch (error) {
            logger.error('[Deduplicator] Failed to check partial refunds:', error);
            return { refundIds: [], totalRefunded: 0, remainingAmount: 0 };
        }
    }

    /**
     * Detect and flag potential duplicate clusters
     * Used for admin review
     */
    static async findDuplicateClusters(
        userId: string,
        windowDays: number = 7
    ): Promise<Array<{ amount: number; merchant: string; transactionIds: string[]; dates: Date[] }>> {
        try {
            return await TransactionRepository.findDuplicateClusters(userId, windowDays);
        } catch (error) {
            logger.error('[Deduplicator] Failed to find duplicate clusters:', error);
            return [];
        }
    }
}


