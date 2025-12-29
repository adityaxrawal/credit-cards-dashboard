import crypto from 'crypto';
import pool from '../../lib/db';
import { isUniqueViolationError } from '../../utils/validation/errorTypeGuards';
import logger from '../../utils/infrastructure/logger';

/**
 * Transaction fingerprint components
 */
interface FingerprintComponents {
    amount: number;
    merchant: string;
    date: Date | string;
    cardLastFour?: string;
    bankDomain?: string;
    direction?: 'debit' | 'credit';
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
    fingerprint: string;
    isDuplicate: boolean;
    existingTransactionId?: string;
    confidence: number;
}

/**
 * TransactionDeduplicator - Prevent duplicate transaction entries
 * 
 * Uses SHA256 fingerprinting based on:
 * - Amount (normalized to 2 decimals)
 * - Merchant (normalized lowercase)
 * - Date (YYYY-MM-DD)
 * - Card last 4 digits
 * - Bank domain
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
            direction: components.direction || 'unknown'
        };

        const fingerprintString = [
            normalized.amount,
            normalized.merchant,
            normalized.date,
            normalized.cardLastFour,
            normalized.bankDomain,
            normalized.direction
        ].join('|');

        return crypto.createHash('sha256').update(fingerprintString).digest('hex');
    }

    /**
     * Normalize merchant name for consistent fingerprinting
     */
    private static normalizeMerchant(merchant: string): string {
        if (!merchant) return 'unknown';

        return merchant
            .toLowerCase()
            .trim()
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
        fingerprint: string
    ): Promise<DeduplicationResult> {
        try {
            const result = await pool.query(
                `SELECT id, amount, merchant, transaction_date 
         FROM transactions 
         WHERE user_id = $1 AND txn_fingerprint = $2 
         LIMIT 1`,
                [userId, fingerprint]
            );

            if (result.rows.length > 0) {
                return {
                    fingerprint,
                    isDuplicate: true,
                    existingTransactionId: result.rows[0].id,
                    confidence: 1.0
                };
            }

            return {
                fingerprint,
                isDuplicate: false,
                confidence: 1.0
            };
        } catch (error) {
            logger.error('[Deduplicator] Failed to check duplicate:', error);
            // On error, assume not duplicate to avoid losing transactions
            return {
                fingerprint,
                isDuplicate: false,
                confidence: 0.5
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
        toleranceMs: number = 86400000 // 24 hours
    ): Promise<{ isNearDuplicate: boolean; matchedIds: string[]; confidence: number }> {
        try {
            const dateStart = new Date(
                (components.date instanceof Date ? components.date : new Date(components.date)).getTime() - toleranceMs
            );
            const dateEnd = new Date(
                (components.date instanceof Date ? components.date : new Date(components.date)).getTime() + toleranceMs
            );

            const result = await pool.query(
                `SELECT id, merchant, amount, txn_fingerprint 
         FROM transactions 
         WHERE user_id = $1 
           AND amount = $2 
           AND transaction_date BETWEEN $3 AND $4
         LIMIT 5`,
                [userId, components.amount, dateStart, dateEnd]
            );

            if (result.rows.length === 0) {
                return { isNearDuplicate: false, matchedIds: [], confidence: 1.0 };
            }

            // Check merchant similarity
            const normalizedMerchant = this.normalizeMerchant(components.merchant);
            const matches = result.rows.filter(row => {
                const rowMerchant = this.normalizeMerchant(row.merchant);
                return this.merchantSimilarity(normalizedMerchant, rowMerchant) > 0.7;
            });

            return {
                isNearDuplicate: matches.length > 0,
                matchedIds: matches.map(m => m.id),
                confidence: matches.length > 0 ? 0.8 : 1.0
            };
        } catch (error) {
            logger.error('[Deduplicator] Failed to check near-duplicate:', error);
            return { isNearDuplicate: false, matchedIds: [], confidence: 0.5 };
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
        createFn: () => Promise<string | null>
    ): Promise<{ transactionId: string | null; isNew: boolean }> {
        // First check if exists
        const existing = await this.checkDuplicate(userId, fingerprint);

        if (existing.isDuplicate) {
            logger.debug('[Deduplicator] Found existing transaction:', {
                fingerprint: fingerprint.substring(0, 16),
                existingId: existing.existingTransactionId
            });
            return {
                transactionId: existing.existingTransactionId || null,
                isNew: false
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
                const retryCheck = await this.checkDuplicate(userId, fingerprint);
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
            const result = await pool.query(
                `SELECT id, amount, merchant, transaction_date, email_sender, direction
         FROM transactions 
         WHERE user_id = $1 AND (txn_fingerprint IS NULL OR txn_fingerprint = '')
         LIMIT $2`,
                [userId, batchSize]
            );

            if (result.rows.length === 0) {
                hasMore = false;
                break;
            }

            for (const row of result.rows) {
                const fingerprint = this.generateFingerprint({
                    amount: parseFloat(row.amount),
                    merchant: row.merchant,
                    date: row.transaction_date,
                    bankDomain: row.email_sender,
                    direction: row.direction
                });

                await pool.query(
                    `UPDATE transactions SET txn_fingerprint = $1 WHERE id = $2`,
                    [fingerprint, row.id]
                );
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

            const result = await pool.query(
                `SELECT id, merchant, amount, transaction_date
                 FROM transactions
                 WHERE user_id = $1
                   AND amount = $2
                   AND direction = 'debit'
                   AND transaction_date BETWEEN $3 AND $4
                   AND linked_transaction_id IS NULL
                 ORDER BY transaction_date DESC
                 LIMIT 5`,
                [userId, amount, windowStart, refundDate]
            );

            for (const row of result.rows) {
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

            const result = await pool.query(
                `SELECT id, merchant, amount, transaction_date, is_provisional
                 FROM transactions
                 WHERE user_id = $1
                   AND amount BETWEEN $2 AND $3
                   AND direction = 'debit'
                   AND transaction_date BETWEEN $4 AND $5
                   AND (is_provisional = TRUE OR transaction_status = 'pending')
                 ORDER BY transaction_date DESC
                 LIMIT 5`,
                [userId, amountMin, amountMax, windowStart, settlementDate]
            );

            for (const row of result.rows) {
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
            await pool.query(
                `UPDATE transactions 
                 SET linked_transaction_id = $1, link_type = $2, updated_at = NOW()
                 WHERE id = $3`,
                [linkedTransactionId, linkType, transactionId]
            );
            return true;
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
            const originalResult = await pool.query(
                `SELECT amount FROM transactions WHERE id = $1`,
                [originalTransactionId]
            );

            if (originalResult.rows.length === 0) {
                return { refundIds: [], totalRefunded: 0, remainingAmount: 0 };
            }

            const originalAmount = parseFloat(originalResult.rows[0].amount);

            const refundsResult = await pool.query(
                `SELECT id, amount
                 FROM transactions
                 WHERE user_id = $1
                   AND linked_transaction_id = $2
                   AND link_type IN ('refund', 'partial_refund')`,
                [userId, originalTransactionId]
            );

            const refundIds = refundsResult.rows.map(r => r.id);
            const totalRefunded = refundsResult.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

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
            const result = await pool.query(
                `SELECT amount, merchant, 
                        ARRAY_AGG(id) as ids,
                        ARRAY_AGG(transaction_date) as dates
                 FROM transactions
                 WHERE user_id = $1
                   AND transaction_date > NOW() - INTERVAL '${windowDays} days'
                 GROUP BY amount, LOWER(TRIM(merchant))
                 HAVING COUNT(*) > 1
                 ORDER BY COUNT(*) DESC
                 LIMIT 50`,
                [userId]
            );

            return result.rows.map(row => ({
                amount: parseFloat(row.amount),
                merchant: row.merchant,
                transactionIds: row.ids,
                dates: row.dates
            }));
        } catch (error) {
            logger.error('[Deduplicator] Failed to find duplicate clusters:', error);
            return [];
        }
    }
}

