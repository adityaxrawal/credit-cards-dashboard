/**
 * Audit Trail Repository
 * Data access layer for audit trail / transaction audit logs
 */

import { query } from '@shared/database/db';

export interface AuditTrailRow {
    id: string;
    user_id: string;
    transaction_id: string | null;
    action: string;
    previous_data: any;
    new_data: any;
    changes: any;
    ip_address: string | null;
    user_agent: string | null;
    changed_at: Date;
}

export interface CreateAuditEntryData {
    userId: string;
    entityId?: string;
    action: string;
    previousData?: any;
    newData?: any;
    changes?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
}

export interface AuditFilters {
    startDate?: string;
    endDate?: string;
    action?: string;
    entityType?: string;
    limit?: number;
}

export class AuditTrailRepository {
    /**
     * Create a new audit entry
     */
    static async create(data: CreateAuditEntryData): Promise<string> {
        const result = await query(
            `INSERT INTO transaction_audit_log 
             (user_id, transaction_id, action, previous_data, new_data, changes, ip_address, user_agent, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING id`,
            [
                data.userId,
                data.entityId,
                data.action,
                data.previousData ? JSON.stringify(data.previousData) : null,
                data.newData ? JSON.stringify(data.newData) : null,
                data.changes ? JSON.stringify(data.changes) : null,
                data.ipAddress,
                data.userAgent,
            ]
        );
        return result.rows[0].id;
    }

    /**
     * Log a transaction change (simplified insert)
     */
    static async logTransactionChange(
        userId: string,
        transactionId: string,
        action: string,
        previousData: any,
        newData: any,
        changes: any
    ): Promise<void> {
        await query(
            `INSERT INTO transaction_audit_log 
             (user_id, transaction_id, action, previous_data, new_data, changes, changed_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
                userId,
                transactionId,
                action,
                previousData ? JSON.stringify(previousData) : null,
                newData ? JSON.stringify(newData) : null,
                JSON.stringify(changes),
            ]
        );
    }

    /**
     * Get audit history for a specific entity
     */
    static async getEntityHistory(userId: string, entityId: string, entityType: string): Promise<AuditTrailRow[]> {
        const result = await query(
            `SELECT * FROM transaction_audit_log 
             WHERE user_id = $1 
             AND transaction_id = $2
             AND action LIKE $3
             ORDER BY changed_at DESC
             LIMIT 100`,
            [userId, entityId, `${entityType}:%`]
        );
        return result.rows;
    }

    /**
     * Get user audit log with filters
     */
    static async findByUserId(userId: string, filters?: AuditFilters): Promise<AuditTrailRow[]> {
        let sql = `SELECT * FROM transaction_audit_log WHERE user_id = $1`;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (filters?.startDate) {
            sql += ` AND changed_at >= $${paramIndex}`;
            params.push(filters.startDate);
            paramIndex++;
        }

        if (filters?.endDate) {
            sql += ` AND changed_at <= $${paramIndex}`;
            params.push(filters.endDate);
            paramIndex++;
        }

        if (filters?.action) {
            sql += ` AND action LIKE $${paramIndex}`;
            params.push(`%:${filters.action}`);
            paramIndex++;
        }

        if (filters?.entityType) {
            sql += ` AND action LIKE $${paramIndex}`;
            params.push(`${filters.entityType}:%`);
            paramIndex++;
        }

        sql += ` ORDER BY changed_at DESC LIMIT $${paramIndex}`;
        params.push(filters?.limit || 100);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get activity counts grouped by action
     */
    static async getActivityCounts(userId: string, startDate: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                COUNT(*) as total,
                action,
                COUNT(*) FILTER (WHERE action LIKE 'transaction:%') as transactions,
                COUNT(*) FILTER (WHERE action LIKE 'account:%') as accounts,
                COUNT(*) FILTER (WHERE action LIKE 'loan:%') as loans,
                COUNT(*) FILTER (WHERE action LIKE 'goal:%') as goals
             FROM transaction_audit_log 
             WHERE user_id = $1 AND changed_at >= $2
             GROUP BY action`,
            [userId, startDate]
        );
        return result.rows;
    }

    /**
     * Get recent audit entries
     */
    static async getRecent(userId: string, startDate: string, limit: number = 10): Promise<AuditTrailRow[]> {
        const result = await query(
            `SELECT * FROM transaction_audit_log 
             WHERE user_id = $1 AND changed_at >= $2
             ORDER BY changed_at DESC
             LIMIT $3`,
            [userId, startDate, limit]
        );
        return result.rows;
    }
}
