/**
 * Recurring Pattern Service
 * Detects and manages recurring transaction patterns (subscriptions, regular payments)
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';
import dayjs from 'dayjs';

export interface RecurringPattern {
    id: string;
    userId: string;
    merchant: string;
    merchantNormalized: string;
    typicalAmount: number;
    amountVariance: number;
    frequencyType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    frequencyDays: number | null;
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    firstOccurrence: Date;
    lastOccurrence: Date | null;
    nextExpected: Date | null;
    category: string | null;
    categoryId: string | null;
    transactionType: string;
    instrumentType: string | null;
    instrumentId: string | null;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    confidenceScore: number;
    occurrenceCount: number;
    isSubscription: boolean;
    subscriptionType: string | null;
    isAutoDetected: boolean;
    userConfirmed: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface DetectedPattern {
    merchant: string;
    typicalAmount: number;
    frequencyType: string;
    dayOfMonth?: number;
    occurrenceCount: number;
    confidenceScore: number;
    lastOccurrence: Date;
    transactions: string[];
}

export class RecurringPatternService {
    /**
     * Get all patterns for a user
     */
    static async getPatterns(
        userId: string,
        filters: { status?: string; limit?: number; offset?: number } = {}
    ): Promise<{ patterns: RecurringPattern[]; total: number }> {
        const { status = 'active', limit = 50, offset = 0 } = filters;

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM recurring_patterns WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)`,
            [userId, status || null]
        );
        const total = parseInt(countResult.rows[0]?.count || '0');

        const result = await pool.query(
            `SELECT 
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
             WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
             ORDER BY next_expected ASC NULLS LAST, occurrence_count DESC
             LIMIT $3 OFFSET $4`,
            [userId, status || null, limit, offset]
        );

        return { patterns: result.rows, total };
    }

    /**
     * Detect recurring patterns from transaction history
     */
    static async detectPatterns(userId: string): Promise<DetectedPattern[]> {
        // Get transactions from last 6 months grouped by normalized merchant
        const result = await pool.query(
            `SELECT 
                LOWER(TRIM(merchant)) as merchant_normalized,
                merchant,
                array_agg(id) as transaction_ids,
                array_agg(transaction_date ORDER BY transaction_date) as dates,
                array_agg(amount) as amounts,
                COUNT(*) as occurrence_count,
                AVG(amount) as avg_amount,
                STDDEV(amount) as stddev_amount
             FROM transactions
             WHERE user_id = $1 
               AND transaction_date >= NOW() - INTERVAL '6 months'
               AND direction = 'debit'
             GROUP BY LOWER(TRIM(merchant)), merchant
             HAVING COUNT(*) >= 2
             ORDER BY COUNT(*) DESC`,
            [userId]
        );

        const patterns: DetectedPattern[] = [];

        for (const row of result.rows) {
            const dates = row.dates.map((d: Date) => dayjs(d));
            const amounts = row.amounts.map((a: string) => parseFloat(a));

            // Calculate intervals between transactions
            const intervals: number[] = [];
            for (let i = 1; i < dates.length; i++) {
                intervals.push(dates[i].diff(dates[i - 1], 'day'));
            }

            if (intervals.length === 0) continue;

            // Analyze interval pattern
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const intervalVariance = this.calculateVariance(intervals);

            // Determine frequency type
            let frequencyType = 'custom';
            let confidence = 0.3;

            if (avgInterval >= 27 && avgInterval <= 33 && intervalVariance < 5) {
                frequencyType = 'monthly';
                confidence = 0.9;
            } else if (avgInterval >= 6 && avgInterval <= 8 && intervalVariance < 2) {
                frequencyType = 'weekly';
                confidence = 0.85;
            } else if (avgInterval >= 13 && avgInterval <= 15 && intervalVariance < 3) {
                frequencyType = 'biweekly';
                confidence = 0.8;
            } else if (avgInterval >= 88 && avgInterval <= 95 && intervalVariance < 10) {
                frequencyType = 'quarterly';
                confidence = 0.75;
            } else if (avgInterval >= 360 && avgInterval <= 370 && intervalVariance < 15) {
                frequencyType = 'yearly';
                confidence = 0.7;
            } else if (intervalVariance < avgInterval * 0.2) {
                // Custom but consistent
                confidence = 0.5;
            }

            // Check amount consistency
            const amountVariance = row.stddev_amount ? parseFloat(row.stddev_amount) / parseFloat(row.avg_amount) : 0;
            if (amountVariance > 0.3) {
                confidence *= 0.7; // Reduce confidence for inconsistent amounts
            }

            // Get day of month for monthly patterns
            let dayOfMonth: number | undefined;
            if (frequencyType === 'monthly') {
                const days = dates.map((d: dayjs.Dayjs) => d.date());
                const avgDay = days.reduce((a: number, b: number) => a + b, 0) / days.length;
                dayOfMonth = Math.round(avgDay);
            }

            patterns.push({
                merchant: row.merchant,
                typicalAmount: parseFloat(row.avg_amount),
                frequencyType,
                dayOfMonth,
                occurrenceCount: parseInt(row.occurrence_count),
                confidenceScore: confidence,
                lastOccurrence: dates[dates.length - 1].toDate(),
                transactions: row.transaction_ids,
            });
        }

        // Sort by confidence and occurrence count
        return patterns
            .filter(p => p.confidenceScore >= 0.5)
            .sort((a, b) => {
                if (b.confidenceScore !== a.confidenceScore) {
                    return b.confidenceScore - a.confidenceScore;
                }
                return b.occurrenceCount - a.occurrenceCount;
            });
    }

    /**
     * Save a detected pattern to the database
     */
    static async savePattern(
        userId: string,
        pattern: DetectedPattern
    ): Promise<RecurringPattern> {
        const nextExpected = this.calculateNextExpected(
            pattern.lastOccurrence,
            pattern.frequencyType as any,
            pattern.dayOfMonth
        );

        const result = await pool.query(
            `INSERT INTO recurring_patterns (
                user_id, merchant, merchant_normalized, typical_amount,
                frequency_type, day_of_month, first_occurrence, last_occurrence,
                next_expected, occurrence_count, confidence_score,
                matched_transaction_ids, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
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
            RETURNING *`,
            [
                userId,
                pattern.merchant,
                pattern.merchant.toLowerCase().trim(),
                pattern.typicalAmount,
                pattern.frequencyType,
                pattern.dayOfMonth || null,
                pattern.transactions.length > 0 ? dayjs(pattern.lastOccurrence).subtract(pattern.occurrenceCount - 1, 'month').toDate() : new Date(),
                pattern.lastOccurrence,
                nextExpected,
                pattern.occurrenceCount,
                pattern.confidenceScore,
                pattern.transactions,
            ]
        );

        logger.info('recurring_pattern_saved', { userId, merchant: pattern.merchant });
        return result.rows[0];
    }

    /**
     * Pause a pattern
     */
    static async pausePattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean; error?: string }> {
        const result = await pool.query(
            `UPDATE recurring_patterns 
             SET status = 'paused', updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [patternId, userId]
        );

        if (result.rowCount === 0) {
            return { success: false, error: 'Pattern not found' };
        }

        return { success: true };
    }

    /**
     * Resume a paused pattern
     */
    static async resumePattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean; error?: string }> {
        const result = await pool.query(
            `UPDATE recurring_patterns 
             SET status = 'active', updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [patternId, userId]
        );

        if (result.rowCount === 0) {
            return { success: false, error: 'Pattern not found' };
        }

        return { success: true };
    }

    /**
     * Delete a pattern
     */
    static async deletePattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean; error?: string }> {
        const result = await pool.query(
            `DELETE FROM recurring_patterns WHERE id = $1 AND user_id = $2 RETURNING id`,
            [patternId, userId]
        );

        if (result.rowCount === 0) {
            return { success: false, error: 'Pattern not found' };
        }

        return { success: true };
    }

    /**
     * Confirm a pattern (user verification)
     */
    static async confirmPattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean }> {
        await pool.query(
            `UPDATE recurring_patterns 
             SET user_confirmed = true, confidence_score = GREATEST(confidence_score, 0.95), updated_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [patternId, userId]
        );

        return { success: true };
    }

    /**
     * Calculate next expected date based on frequency
     */
    private static calculateNextExpected(
        lastOccurrence: Date,
        frequencyType: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom',
        dayOfMonth?: number
    ): Date {
        const last = dayjs(lastOccurrence);

        switch (frequencyType) {
            case 'daily':
                return last.add(1, 'day').toDate();
            case 'weekly':
                return last.add(1, 'week').toDate();
            case 'biweekly':
                return last.add(2, 'week').toDate();
            case 'monthly':
                const next = last.add(1, 'month');
                if (dayOfMonth) {
                    return next.date(Math.min(dayOfMonth, next.daysInMonth())).toDate();
                }
                return next.toDate();
            case 'quarterly':
                return last.add(3, 'month').toDate();
            case 'yearly':
                return last.add(1, 'year').toDate();
            default:
                return last.add(30, 'day').toDate(); // Default to monthly
        }
    }

    /**
     * Calculate variance of an array of numbers
     */
    private static calculateVariance(values: number[]): number {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }
}
