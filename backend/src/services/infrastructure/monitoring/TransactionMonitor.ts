import { LogRepository } from '../../../repositories/LogRepository';
import logger from '../../../utils/infrastructure/logger';

interface PeriodStats {
    totalProcessed: number;
    terminated: number;
    terminationTypes: number;
    terminationCategories: string[];
    classifierStats: Array<{
        classification_method: string;
        total: number;
        avg_confidence: number;
    }>;
}

export class TransactionMonitor {
    /**
     * Get processing stats for a user over a period
     */
    static async getStats(
        userId: string,
        period: 'day' | 'week' | 'month' = 'day'
    ): Promise<PeriodStats> {
        const startDate = this.getPeriodStart(period);

        try {
            const row = await LogRepository.getProcessingStats(userId, startDate);

            // Get classifier breakdown
            const classifierStatsRows = await LogRepository.getClassifierStats(userId, startDate);

            return {
                totalProcessed: parseInt(row.total_processed, 10),
                terminated: parseInt(row.terminated, 10),
                terminationTypes: parseInt(row.termination_types, 10) || 0,
                terminationCategories: row.termination_categories || [],
                classifierStats: classifierStatsRows.map(r => ({
                    classification_method: r.classification_method,
                    total: parseInt(r.total, 10),
                    avg_confidence: parseFloat(r.avg_confidence)
                }))
            };
        } catch (error) {
            logger.error('Failed to get monitoring stats:', error);
            throw error;
        }
    }

    /**
     * Get classifier accuracy stats (rule-based vs GPT)
     */
    static async getClassifierAccuracy(period: 'day' | 'week' = 'day'): Promise<Array<{
        classification_method: string;
        total: number;
        avg_confidence: number;
        success_rate?: number;
    }>> {
        const startDate = this.getPeriodStart(period);

        try {
            const rows = await LogRepository.getClassifierAccuracy(startDate);

            return rows.map(r => ({
                classification_method: r.classification_method,
                total: parseInt(r.total, 10),
                avg_confidence: parseFloat(r.avg_confidence) || 0,
                success_rate: parseFloat(r.success_rate) || 0
            }));
        } catch (error) {
            logger.error('Failed to get classifier accuracy:', error);
            throw error;
        }
    }

    /**
     * Get termination report for a user over a date range
     */
    static async getTerminationReport(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{
        period: { start: Date; end: Date };
        categories: Array<{ status_category: string; count: number; examples: string[] }>;
        totalTerminated: number;
    }> {
        try {
            const rows = await LogRepository.getTerminationReport(userId, startDate, endDate);

            // Limit examples in JS
            const categories = rows.map(row => ({
                status_category: row.status_category,
                count: parseInt(row.count, 10),
                examples: (row.reasons || []).slice(0, 5)
            }));

            return {
                period: { start: startDate, end: endDate },
                categories,
                totalTerminated: categories.reduce((s, r) => s + r.count, 0)
            };
        } catch (error) {
            logger.error('Failed to get termination report:', error);
            throw error;
        }
    }

    /**
     * Helper to get period start date
     */
    private static getPeriodStart(period: string): Date {
        const now = new Date();
        if (period === 'day') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (period === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
}
