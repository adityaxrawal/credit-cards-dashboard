import pool from '../../lib/db';
import logger from '../../utils/logger';

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
            const stats = await pool.query(
                `SELECT 
                    COUNT(*) as total_processed,
                    SUM(CASE WHEN processing_status = 'terminated' THEN 1 ELSE 0 END) as terminated,
                    COUNT(DISTINCT status_category) FILTER (WHERE processing_status = 'terminated') as termination_types,
                    array_agg(DISTINCT status_category) FILTER (WHERE processing_status = 'terminated') as termination_categories
                FROM email_processing_log
                WHERE user_id = $1 AND processed_at >= $2`,
                [userId, startDate]
            );

            // Get classifier breakdown
            const classifierStats = await pool.query(
                `SELECT 
                    classification_method,
                    COUNT(*) as total,
                    AVG(CAST(confidence_score AS FLOAT)) as avg_confidence
                FROM email_processing_log
                WHERE user_id = $1 
                  AND processed_at >= $2
                  AND processing_status != 'terminated'
                  AND classification_method IS NOT NULL
                GROUP BY classification_method
                ORDER BY total DESC`,
                [userId, startDate]
            );

            const row = stats.rows[0];
            return {
                totalProcessed: parseInt(row.total_processed, 10),
                terminated: parseInt(row.terminated, 10),
                terminationTypes: parseInt(row.termination_types, 10) || 0,
                terminationCategories: row.termination_categories || [],
                classifierStats: classifierStats.rows.map(r => ({
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
            const stats = await pool.query(
                `SELECT 
                    classification_method,
                    COUNT(*) as total,
                    AVG(CAST(confidence_score AS FLOAT)) as avg_confidence,
                    SUM(CASE WHEN processing_status = 'success' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as success_rate
                FROM email_processing_log
                WHERE processing_status IN ('success', 'failed')
                  AND processed_at >= $1
                  AND classification_method IS NOT NULL
                GROUP BY classification_method
                ORDER BY total DESC`,
                [startDate]
            );

            return stats.rows.map(r => ({
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
            const result = await pool.query(
                `SELECT 
                    status_category,
                    COUNT(*) as count,
                    array_agg(reason) as reasons
                FROM email_processing_log
                WHERE user_id = $1 
                  AND processing_status = 'terminated'
                  AND processed_at BETWEEN $2 AND $3
                GROUP BY status_category
                ORDER BY count DESC`,
                [userId, startDate, endDate]
            );

            // Limit examples in JS
            const categories = result.rows.map(row => ({
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
