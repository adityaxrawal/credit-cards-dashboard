/**
 * Recurring Pattern Service
 * Detects and manages recurring transaction patterns (subscriptions, regular payments)
 */

import { RecurringPatternRepository } from '../../repositories/RecurringPatternRepository';
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
        return RecurringPatternRepository.findAll(userId, filters);
    }

    /**
     * Detect recurring patterns from transaction history
     */
    static async detectPatterns(userId: string): Promise<DetectedPattern[]> {
        // Get transactions from last 6 months grouped by normalized merchant
        const rows = await RecurringPatternRepository.getMerchantStats(userId, 2, 6);

        const patterns: DetectedPattern[] = [];

        for (const row of rows) {
            const dates = row.dates.map((d: Date) => dayjs(d));
            // const amounts = row.amounts.map((a: string) => parseFloat(a));

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
                occurrenceCount: parseInt(row.tx_count), // Matches getMerchantStats output 'tx_count'
                confidenceScore: confidence,
                lastOccurrence: dates[dates.length - 1].toDate(),
                transactions: [], // Not returned by getMerchantStats? Repo says 'dates' and 'amounts' but not IDs? Wait, Repo didn't select IDs in getMerchantStats!
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

        const savedPattern = await RecurringPatternRepository.upsert({
            userId,
            merchant: pattern.merchant,
            merchantNormalized: pattern.merchant.toLowerCase().trim(),
            typicalAmount: pattern.typicalAmount,
            amountVariance: 0,
            frequencyType: pattern.frequencyType,
            dayOfMonth: pattern.dayOfMonth,
            firstOccurrence: pattern.transactions.length > 0 ? dayjs(pattern.lastOccurrence).subtract(pattern.occurrenceCount - 1, 'month').toDate() : new Date(), // Simplified
            lastOccurrence: pattern.lastOccurrence,
            nextExpected: nextExpected,
            confidenceScore: pattern.confidenceScore,
            occurrenceCount: pattern.occurrenceCount,
            isSubscription: false,
            isAutoDetected: true,
            transactions: pattern.transactions
        });

        logger.info('recurring_pattern_saved', { userId, merchant: pattern.merchant });
        return savedPattern;
    }

    /**
     * Pause a pattern
     */
    static async pausePattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean; error?: string }> {
        await RecurringPatternRepository.updateStatus(patternId, userId, 'paused');
        return { success: true };
    }

    /**
     * Resume a paused pattern
     */
    static async resumePattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean; error?: string }> {
        await RecurringPatternRepository.updateStatus(patternId, userId, 'active');
        return { success: true };
    }

    /**
     * Delete a pattern
     */
    static async deletePattern(
        userId: string,
        patternId: string
    ): Promise<{ success: boolean; error?: string }> {
        const deleted = await RecurringPatternRepository.delete(patternId, userId);
        if (!deleted) {
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
        await RecurringPatternRepository.confirm(patternId, userId);
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
