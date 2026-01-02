/**
 * Ingestion Log Service
 * Handles retrieval and filtering of email processing logs
 * 
 * Extracted from GmailService as part of Issue #3 decomposition
 */

import { query } from '@shared/database/db';

export interface IngestionLogFilters {
    page: number;
    limit: number;
    status?: string;
    search?: string;
}

export interface IngestionLogResult {
    data: any[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export class IngestionLogService {
    /**
     * Get ingestion logs with pagination and filters
     */
    static async getLogs(userId: string, filters: IngestionLogFilters): Promise<IngestionLogResult> {
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const offset = (page - 1) * limit;

        const where: string[] = ['l.user_id = $1'];
        const params: any[] = [userId];
        let paramIndex = 2;

        if (filters.status) {
            where.push(`l.status_category = $${paramIndex++}`);
            params.push(filters.status);
        }

        if (filters.search) {
            where.push(`(l.subject ILIKE $${paramIndex} OR l.from_email ILIKE $${paramIndex})`);
            params.push(`%${filters.search}%`);
            paramIndex++;
        }

        const whereClause = where.join(' AND ');

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) as total FROM email_processing_log l WHERE ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].total);

        // Get data with transaction info
        const result = await query(
            `SELECT l.*, 
                    t.id as transaction_id,
                    t.amount as transaction_amount, 
                    t.merchant as transaction_merchant,
                    t.category as transaction_category
             FROM email_processing_log l
             LEFT JOIN transactions t ON l.transaction_id = t.id
             WHERE ${whereClause}
             ORDER BY l.received_date DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...params, limit, offset]
        );

        return {
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get log by ID
     */
    static async getLogById(userId: string, logId: string) {
        const result = await query(
            `SELECT l.*, 
                    t.id as transaction_id,
                    t.amount as transaction_amount, 
                    t.merchant as transaction_merchant,
                    t.category as transaction_category
             FROM email_processing_log l
             LEFT JOIN transactions t ON l.transaction_id = t.id
             WHERE l.id = $1 AND l.user_id = $2`,
            [logId, userId]
        );

        return result.rows[0] || null;
    }

    /**
     * Get log statistics
     */
    static async getLogStats(userId: string) {
        const result = await query(
            `SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status_category = 'success') as success,
                COUNT(*) FILTER (WHERE status_category = 'error') as errors,
                COUNT(*) FILTER (WHERE status_category = 'duplicate') as duplicates,
                COUNT(*) FILTER (WHERE status_category = 'terminated') as terminated
             FROM email_processing_log
             WHERE user_id = $1`,
            [userId]
        );

        const row = result.rows[0] || {};
        return {
            total: parseInt(row.total || '0'),
            success: parseInt(row.success || '0'),
            errors: parseInt(row.errors || '0'),
            duplicates: parseInt(row.duplicates || '0'),
            terminated: parseInt(row.terminated || '0'),
        };
    }
}
