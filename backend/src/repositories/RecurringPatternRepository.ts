/**
 * Recurring Pattern Repository
 * Data access layer for recurring transaction patterns
 */

import { query } from '../lib/db';

export class RecurringPatternRepository {
    /**
     * Get all patterns for user with filters
     */
    static async findAll(userId: string, filters: { status?: string; limit?: number; offset?: number }): Promise<{ patterns: any[]; total: number }> {
        let sql = `
            SELECT 
                id, user_id as "userId", merchant, merchant_normalized as "merchantNormalized",
                typical_amount as "typicalAmount", amount_variance as "amountVariance",
                frequency_type as "frequencyType", frequency_days as "frequencyDays",
                day_of_month as "dayOfMonth", day_of_week as "dayOfWeek",
                first_occurrence as "firstOccurrence", last_occurrence as "lastOccurrence",
                next_expected as "nextExpected", category, category_id as "categoryId",
                transaction_type as "transactionType", instrument_type as "instrumentType",
                instrument_id as "instrumentId", status, confidence_score as "confidenceScore",
                occurrence_count as "occurrenceCount", is_subscription as "isSubscription",
                subscription_type as "subscriptionType", is_auto_detected as "isAutoDetected",
                user_confirmed as "userConfirmed", created_at as "createdAt", updated_at as "updatedAt"
            FROM recurring_patterns 
            WHERE user_id = $1`;

        const countSql = `SELECT COUNT(*) FROM recurring_patterns WHERE user_id = $1`;
        const params: any[] = [userId];
        let idx = 2;

        if (filters.status) {
            sql += ` AND status = $${idx}`;
            params.push(filters.status);
            idx++;
        }

        sql += ` ORDER BY next_expected ASC NULLS LAST, created_at DESC`;

        if (filters.limit) {
            sql += ` LIMIT $${idx}`;
            params.push(filters.limit);
            idx++;
        }

        if (filters.offset) {
            sql += ` OFFSET $${idx}`;
            params.push(filters.offset);
        }

        const result = await query(sql, params);
        const countResult = await query(countSql, [userId]);

        return {
            patterns: result.rows,
            total: parseInt(countResult.rows[0]?.count) || 0,
        };
    }

    /**
     * Get merchant transaction stats for pattern detection
     */
    static async getMerchantStats(userId: string, minTransactions: number, months: number): Promise<any[]> {
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
               AND transaction_date >= CURRENT_DATE - INTERVAL '${months} months'
               AND merchant_normalized IS NOT NULL
             GROUP BY merchant_normalized
             HAVING COUNT(*) >= $2
             ORDER BY COUNT(*) DESC`,
            [userId, minTransactions]
        );
        return result.rows;
    }

    /**
     * Upsert a pattern
     */
    static async upsert(data: {
        userId: string;
        merchant: string;
        merchantNormalized: string;
        typicalAmount: number;
        amountVariance: number;
        frequencyType: string;
        dayOfMonth?: number;
        firstOccurrence: Date;
        lastOccurrence: Date;
        nextExpected: Date;
        confidenceScore: number;
        occurrenceCount: number;
        isSubscription: boolean;
        isAutoDetected: boolean;
        transactions: string[];
    }): Promise<any> {
        const result = await query(
            `INSERT INTO recurring_patterns (
                user_id, merchant, merchant_normalized, typical_amount, amount_variance,
                frequency_type, day_of_month, first_occurrence, last_occurrence,
                next_expected, occurrence_count, confidence_score,
                matched_transaction_ids, is_subscription, is_auto_detected, status
            ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
            ON CONFLICT (user_id, merchant_normalized, frequency_type) 
            WHERE status = 'active'
            DO UPDATE SET
                typical_amount = EXCLUDED.typical_amount,
                last_occurrence = EXCLUDED.last_occurrence,
                next_expected = EXCLUDED.next_expected,
                occurrence_count = EXCLUDED.occurrence_count,
                confidence_score = EXCLUDED.confidence_score,
                matched_transaction_ids = EXCLUDED.matched_transaction_ids,
                updated_at = NOW()
            RETURNING 
                id, user_id as "userId", merchant, merchant_normalized as "merchantNormalized",
                typical_amount as "typicalAmount", amount_variance as "amountVariance",
                frequency_type as "frequencyType", frequency_days as "frequencyDays",
                day_of_month as "dayOfMonth", day_of_week as "dayOfWeek",
                first_occurrence as "firstOccurrence", last_occurrence as "lastOccurrence",
                next_expected as "nextExpected", category, category_id as "categoryId",
                transaction_type as "transactionType", instrument_type as "instrumentType",
                instrument_id as "instrumentId", status, confidence_score as "confidenceScore",
                occurrence_count as "occurrenceCount", is_subscription as "isSubscription",
                subscription_type as "subscriptionType", is_auto_detected as "isAutoDetected",
                user_confirmed as "userConfirmed", created_at as "createdAt", updated_at as "updatedAt"`,
            [
                data.userId,
                data.merchant,
                data.merchantNormalized,
                data.typicalAmount,
                data.frequencyType,
                data.dayOfMonth || null,
                data.firstOccurrence,
                data.lastOccurrence,
                data.nextExpected,
                data.occurrenceCount,
                data.confidenceScore,
                data.transactions,
                data.isSubscription,
                data.isAutoDetected,
            ]
        );
        return result.rows[0];
    }

    /**
     * Update pattern status
     */
    static async updateStatus(patternId: string, userId: string, status: string): Promise<void> {
        await query(
            `UPDATE recurring_patterns SET status = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
            [patternId, userId, status]
        );
    }

    /**
     * Confirm pattern
     */
    static async confirm(patternId: string, userId: string): Promise<void> {
        await query(
            `UPDATE recurring_patterns SET user_confirmed = true, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
            [patternId, userId]
        );
    }

    /**
     * Delete pattern
     */
    static async delete(patternId: string, userId: string): Promise<boolean> {
        const result = await query(
            `DELETE FROM recurring_patterns WHERE id = $1 AND user_id = $2`,
            [patternId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}
