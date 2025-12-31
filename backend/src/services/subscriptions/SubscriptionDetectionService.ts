/**
 * Subscription Detection Service
 * Identifies and tracks recurring subscriptions from transaction patterns
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

// Known subscription merchants with typical amounts and frequencies
const KNOWN_SUBSCRIPTIONS: Array<{
    pattern: string;
    name: string;
    category: 'streaming' | 'software' | 'news' | 'cloud' | 'fitness' | 'other';
    frequency: 'monthly' | 'yearly' | 'quarterly';
}> = [
        // Streaming
        { pattern: 'NETFLIX', name: 'Netflix', category: 'streaming', frequency: 'monthly' },
        { pattern: 'PRIME VIDEO', name: 'Amazon Prime Video', category: 'streaming', frequency: 'monthly' },
        { pattern: 'HOTSTAR', name: 'Disney+ Hotstar', category: 'streaming', frequency: 'monthly' },
        { pattern: 'SPOTIFY', name: 'Spotify', category: 'streaming', frequency: 'monthly' },
        { pattern: 'YOUTUBE PREMIUM', name: 'YouTube Premium', category: 'streaming', frequency: 'monthly' },
        { pattern: 'APPLE MUSIC', name: 'Apple Music', category: 'streaming', frequency: 'monthly' },
        { pattern: 'SONYLIV', name: 'Sony LIV', category: 'streaming', frequency: 'monthly' },
        { pattern: 'ZEE5', name: 'ZEE5', category: 'streaming', frequency: 'monthly' },

        // Software
        { pattern: 'MICROSOFT 365', name: 'Microsoft 365', category: 'software', frequency: 'yearly' },
        { pattern: 'ADOBE', name: 'Adobe Creative Cloud', category: 'software', frequency: 'monthly' },
        { pattern: 'NOTION', name: 'Notion', category: 'software', frequency: 'monthly' },
        { pattern: 'FIGMA', name: 'Figma', category: 'software', frequency: 'monthly' },
        { pattern: 'GITHUB', name: 'GitHub', category: 'software', frequency: 'monthly' },
        { pattern: 'CHATGPT', name: 'ChatGPT Plus', category: 'software', frequency: 'monthly' },
        { pattern: 'OPENAI', name: 'OpenAI', category: 'software', frequency: 'monthly' },

        // Cloud Storage
        { pattern: 'GOOGLE ONE', name: 'Google One', category: 'cloud', frequency: 'monthly' },
        { pattern: 'ICLOUD', name: 'iCloud', category: 'cloud', frequency: 'monthly' },
        { pattern: 'DROPBOX', name: 'Dropbox', category: 'cloud', frequency: 'monthly' },

        // News
        { pattern: 'TIMES PRIME', name: 'Times Prime', category: 'news', frequency: 'yearly' },
        { pattern: 'ECONOMIC TIMES', name: 'Economic Times', category: 'news', frequency: 'yearly' },

        // Fitness
        { pattern: 'CULT.FIT', name: 'Cult.fit', category: 'fitness', frequency: 'monthly' },
        { pattern: 'FITTERNITY', name: 'Fitternity', category: 'fitness', frequency: 'monthly' },
    ];

export interface DetectedSubscription {
    id: string;
    userId: string;
    merchantName: string;
    normalizedName: string;
    category: 'streaming' | 'software' | 'news' | 'cloud' | 'fitness' | 'other';
    frequency: 'monthly' | 'yearly' | 'quarterly' | 'unknown';
    typicalAmount: number;
    amountVariance: number;
    lastChargeDate: Date;
    nextExpectedDate: Date | null;
    transactionCount: number;
    status: 'active' | 'cancelled' | 'paused';
    confidence: number;
}

export class SubscriptionDetectionService {
    /**
     * Detect subscriptions from transaction history
     */
    static async detectSubscriptions(userId: string): Promise<DetectedSubscription[]> {
        // Get recurring transactions from the last 12 months
        const result = await pool.query(
            `SELECT merchant, 
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
               AND transaction_date > NOW() - INTERVAL '12 months'
             GROUP BY merchant
             HAVING COUNT(*) >= 2
             ORDER BY COUNT(*) DESC`,
            [userId]
        );

        const subscriptions: DetectedSubscription[] = [];

        for (const row of result.rows) {
            const subscription = this.analyzeForSubscription(userId, row);
            if (subscription) {
                subscriptions.push(subscription);
            }
        }

        // Persist detected subscriptions
        for (const sub of subscriptions) {
            await this.persistSubscription(sub);
        }

        return subscriptions;
    }

    /**
     * Analyze a merchant's transactions for subscription patterns
     */
    private static analyzeForSubscription(
        userId: string,
        data: {
            merchant: string;
            tx_count: string;
            avg_amount: string;
            stddev_amount: string;
            last_date: Date;
            first_date: Date;
            amounts: number[];
            dates: Date[];
        }
    ): DetectedSubscription | null {
        const count = parseInt(data.tx_count);
        const avgAmount = parseFloat(data.avg_amount);
        const stddev = parseFloat(data.stddev_amount) || 0;

        // Check if it matches a known subscription
        const knownSub = KNOWN_SUBSCRIPTIONS.find(sub =>
            data.merchant.toUpperCase().includes(sub.pattern)
        );

        // Analyze frequency
        const frequency = this.detectFrequency(data.dates);

        // Calculate confidence
        let confidence = 0;

        // Known subscription bonus
        if (knownSub) confidence += 0.4;

        // Recurring frequency bonus
        if (frequency !== 'unknown') confidence += 0.3;

        // Low variance in amounts bonus
        const varianceRatio = avgAmount > 0 ? stddev / avgAmount : 1;
        if (varianceRatio < 0.1) confidence += 0.2;
        else if (varianceRatio < 0.3) confidence += 0.1;

        // Multiple occurrences bonus
        if (count >= 6) confidence += 0.1;

        // Skip if confidence too low
        if (confidence < 0.3 && !knownSub) {
            return null;
        }

        // Calculate next expected date
        const nextExpected = this.calculateNextDate(data.last_date, frequency);

        return {
            id: `${userId}-${data.merchant}`,
            userId,
            merchantName: data.merchant,
            normalizedName: knownSub?.name || data.merchant,
            category: knownSub?.category || 'other',
            frequency: knownSub?.frequency || frequency,
            typicalAmount: avgAmount,
            amountVariance: stddev,
            lastChargeDate: data.last_date,
            nextExpectedDate: nextExpected,
            transactionCount: count,
            status: 'active',
            confidence,
        };
    }

    /**
     * Detect frequency from transaction dates
     */
    private static detectFrequency(
        dates: Date[]
    ): 'monthly' | 'yearly' | 'quarterly' | 'unknown' {
        if (dates.length < 2) return 'unknown';

        // Calculate average days between transactions
        const intervals: number[] = [];
        for (let i = 1; i < dates.length; i++) {
            const d1 = new Date(dates[i - 1]);
            const d2 = new Date(dates[i]);
            const days = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
            intervals.push(days);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        if (avgInterval >= 350 && avgInterval <= 380) return 'yearly';
        if (avgInterval >= 85 && avgInterval <= 105) return 'quarterly';
        if (avgInterval >= 25 && avgInterval <= 35) return 'monthly';

        return 'unknown';
    }

    /**
     * Calculate next expected charge date
     */
    private static calculateNextDate(
        lastDate: Date,
        frequency: 'monthly' | 'yearly' | 'quarterly' | 'unknown'
    ): Date | null {
        const last = new Date(lastDate);

        switch (frequency) {
            case 'monthly':
                last.setMonth(last.getMonth() + 1);
                return last;
            case 'quarterly':
                last.setMonth(last.getMonth() + 3);
                return last;
            case 'yearly':
                last.setFullYear(last.getFullYear() + 1);
                return last;
            default:
                return null;
        }
    }

    /**
     * Get subscription summary for dashboard
     */
    static async getSubscriptionSummary(userId: string): Promise<{
        totalMonthly: number;
        totalYearly: number;
        subscriptionCount: number;
        byCategory: Record<string, { count: number; monthly: number }>;
    }> {
        const subscriptions = await this.detectSubscriptions(userId);

        let totalMonthly = 0;
        let totalYearly = 0;
        const byCategory: Record<string, { count: number; monthly: number }> = {};

        for (const sub of subscriptions) {
            let monthlyEquivalent = sub.typicalAmount;

            if (sub.frequency === 'yearly') {
                monthlyEquivalent = sub.typicalAmount / 12;
                totalYearly += sub.typicalAmount;
            } else if (sub.frequency === 'quarterly') {
                monthlyEquivalent = sub.typicalAmount / 3;
            }

            totalMonthly += monthlyEquivalent;

            if (!byCategory[sub.category]) {
                byCategory[sub.category] = { count: 0, monthly: 0 };
            }
            byCategory[sub.category].count++;
            byCategory[sub.category].monthly += monthlyEquivalent;
        }

        return {
            totalMonthly,
            totalYearly,
            subscriptionCount: subscriptions.length,
            byCategory,
        };
    }
    /**
     * Persist detected subscription to database
     */
    private static async persistSubscription(sub: DetectedSubscription) {
        try {
            await pool.query(
                `INSERT INTO recurring_patterns (
                    user_id, merchant, merchant_normalized, typical_amount, amount_variance,
                    frequency_type, last_occurrence, next_expected, category,
                    status, confidence_score, is_subscription, is_auto_detected,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, true, true, NOW())
                ON CONFLICT (user_id, merchant_normalized, frequency_type)
                DO UPDATE SET
                    typical_amount = $4,
                    amount_variance = $5,
                    last_occurrence = $7,
                    next_expected = $8,
                    confidence_score = $10,
                    updated_at = NOW()
                WHERE recurring_patterns.user_confirmed = false`,
                [
                    sub.userId, sub.merchantName, sub.normalizedName, sub.typicalAmount, sub.amountVariance,
                    sub.frequency, sub.lastChargeDate, sub.nextExpectedDate, sub.category,
                    sub.confidence
                ]
            );
        } catch (error) {
            logger.error(`[Subscription] Failed to persist subscription ${sub.merchantName}:`, error);
        }
    }

    /**
     * Confirm a subscription
     */
    static async confirmSubscription(userId: string, subscriptionId: string): Promise<boolean> {
        // subscriptionId is likely a pattern ID, passing the ID directly would be better, 
        // but detected subscriptions don't have DB IDs in their interface yet unless persisted.
        // Assuming subscriptionId is the UUID from `recurring_patterns` table.
        const result = await pool.query(
            `UPDATE recurring_patterns 
             SET user_confirmed = true, updated_at = NOW() 
             WHERE id = $1 AND user_id = $2`,
            [subscriptionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Ignore/Dismiss a subscription
     */
    static async ignoreSubscription(userId: string, subscriptionId: string): Promise<boolean> {
        const result = await pool.query(
            `UPDATE recurring_patterns 
             SET status = 'ignored', updated_at = NOW() 
             WHERE id = $1 AND user_id = $2`,
            [subscriptionId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Get active subscriptions from DB
     */
    static async getActiveSubscriptions(userId: string) {
        const result = await pool.query(
            `SELECT * FROM recurring_patterns 
             WHERE user_id = $1 AND is_subscription = true AND status = 'active'
             ORDER BY next_expected ASC`,
            [userId]
        );
        return result.rows;
    }
}
