/**
 * Subscription Repository
 * Data access layer for subscription detection and management
 */

import { query } from '../lib/db';

export class SubscriptionRepository {
    /**
     * Get recurring merchant stats for subscription detection
     */
    static async getRecurringMerchantStats(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                merchant_normalized as merchant,
                COUNT(*) as tx_count,
                AVG(amount) as avg_amount,
                STDDEV(amount) as stddev_amount,
                MAX(transaction_date) as last_date,
                MIN(transaction_date) as first_date,
                ARRAY_AGG(amount ORDER BY transaction_date) as amounts,
                ARRAY_AGG(transaction_date ORDER BY transaction_date) as dates
             FROM transactions
             WHERE user_id = $1 
               AND direction = 'debit'
               AND transaction_date >= CURRENT_DATE - INTERVAL '12 months'
               AND merchant_normalized IS NOT NULL
             GROUP BY merchant_normalized
             HAVING COUNT(*) >= 2
             ORDER BY COUNT(*) DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Persist subscription to database
     */
    static async upsert(sub: {
        id: string;
        userId: string;
        merchantName: string;
        normalizedName: string;
        category: string;
        frequency: string;
        typicalAmount: number;
        amountVariance: number;
        lastChargeDate: Date;
        nextExpectedDate: Date | null;
        transactionCount: number;
        status: string;
        confidence: number;
    }): Promise<any> {
        const result = await query(
            `INSERT INTO recurring_patterns (
                user_id, merchant, merchant_normalized, is_subscription, subscription_type,
                typical_amount, amount_variance, frequency_type, last_occurrence,
                next_expected, occurrence_count, status, confidence_score, created_at, updated_at,
                is_auto_detected
            ) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), true)
            ON CONFLICT (user_id, merchant_normalized, frequency_type) 
            DO UPDATE SET 
                typical_amount = $5, amount_variance = $6, frequency_type = $7,
                last_occurrence = $8, next_expected = $9, occurrence_count = $10,
                confidence_score = $12, updated_at = NOW()
            WHERE recurring_patterns.user_confirmed = false
            RETURNING *`,
            [
                sub.userId, sub.merchantName, sub.normalizedName, sub.category,
                sub.typicalAmount, sub.amountVariance, sub.frequency, sub.lastChargeDate,
                sub.nextExpectedDate, sub.transactionCount, sub.status, sub.confidence,
            ]
        );
        return result.rows[0];
    }

    /**
     * Confirm subscription
     */
    static async confirm(subscriptionId: string, userId: string): Promise<boolean> {
        const result = await query(
            `UPDATE recurring_patterns SET user_confirmed = true, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
            [subscriptionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Ignore subscription
     */
    static async ignore(subscriptionId: string, userId: string): Promise<boolean> {
        const result = await query(
            `UPDATE recurring_patterns SET status = 'ignored', updated_at = NOW() WHERE id = $1 AND user_id = $2`,
            [subscriptionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Get active subscriptions
     */
    static async getActive(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT * FROM recurring_patterns 
             WHERE user_id = $1 AND is_subscription = true AND status = 'active'
             ORDER BY next_expected ASC NULLS LAST`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get subscription summary
     */
    static async getSummary(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                subscription_type as category,
                COUNT(*) as count,
                SUM(typical_amount) as total_amount,
                frequency_type
             FROM recurring_patterns
             WHERE user_id = $1 AND is_subscription = true AND status = 'active'
             GROUP BY subscription_type, frequency_type`,
            [userId]
        );
        return result.rows;
    }
}
