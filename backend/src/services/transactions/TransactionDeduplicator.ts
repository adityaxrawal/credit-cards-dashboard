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
}
