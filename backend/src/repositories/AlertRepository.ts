/**
 * Alert Repository
 * Data access layer for user alerts
 */

import { query } from '../lib/db';

export class AlertRepository {
    /**
     * Get user email for sending alerts
     */
    static async getUserEmail(userId: string): Promise<string | null> {
        const result = await query(
            'SELECT email FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0]?.email || null;
    }
    /**
     * Create a new alert
     */
    static async create(
        userId: string,
        type: string,
        data: {
            title: string;
            message: string;
            priority?: string;
            metadata?: any;
        }
    ): Promise<any> {
        const { rows } = await query(
            `INSERT INTO alerts (user_id, alert_type, title, message, priority, metadata)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                userId,
                type,
                data.title,
                data.message,
                data.priority || 'medium',
                data.metadata || null,
            ]
        );
        return rows[0];
    }

    /**
     * Get alerts for a user
     */
    static async findByUserId(
        userId: string,
        filters?: {
            unreadOnly?: boolean;
            type?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<{ data: any[]; total: number }> {
        const where: string[] = ['user_id = $1'];
        const params: any[] = [userId];
        let paramIndex = 2;

        if (filters?.unreadOnly) {
            where.push(`is_read = false`);
        }

        if (filters?.type) {
            where.push(`alert_type = $${paramIndex++}`);
            params.push(filters.type);
        }

        const whereClause = where.join(' AND ');
        const limit = filters?.limit || 50;
        const offset = filters?.offset || 0;

        const result = await query(
            `SELECT *, COUNT(*) OVER() as total_count 
             FROM alerts 
             WHERE ${whereClause}
             ORDER BY created_at DESC
             LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
            [...params, limit, offset]
        );

        const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
        const data = result.rows.map(row => {
            const { total_count, ...alert } = row;
            return alert;
        });

        return { data, total };
    }

    /**
     * Mark alert as read
     */
    static async markAsRead(userId: string, alertId: string): Promise<boolean> {
        const { rowCount } = await query(
            `UPDATE alerts SET is_read = true WHERE id = $1 AND user_id = $2`,
            [alertId, userId]
        );
        return (rowCount || 0) > 0;
    }

    /**
     * Delete an alert
     */
    static async delete(userId: string, alertId: string): Promise<boolean> {
        const { rowCount } = await query(
            `DELETE FROM alerts WHERE id = $1 AND user_id = $2`,
            [alertId, userId]
        );
        return (rowCount || 0) > 0;
    }

    /**
     * Mark alert as sent via email
     */
    static async markSentViaEmail(alertId: string): Promise<boolean> {
        const { rowCount } = await query(
            `UPDATE alerts SET sent_via_email = true WHERE id = $1`,
            [alertId]
        );
        return (rowCount || 0) > 0;
    }

    /**
     * Check if EMI reminder already sent today
     */
    static async findExistingEmiAlert(userId: string, loanId: string): Promise<boolean> {
        const { rows } = await query(
            `SELECT id FROM alerts 
             WHERE user_id = $1 AND alert_type = 'emi_reminder' 
             AND (metadata->>'loanId')::text = $2
             AND created_at::date = CURRENT_DATE`,
            [userId, loanId]
        );
        return rows.length > 0;
    }
}
