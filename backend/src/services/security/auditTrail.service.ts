import pool from '../../lib/db';
import dayjs from 'dayjs';

/**
 * Audit Trail Service
 * Provides comprehensive audit logging for all data changes
 */

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'view'
    | 'export'
    | 'import'
    | 'login'
    | 'logout'
    | 'lock'
    | 'unlock'
    | 'reconcile'
    | 'transfer'
    | 'impersonate';

export type AuditEntity =
    | 'transaction'
    | 'account'
    | 'card'
    | 'loan'
    | 'goal'
    | 'bill'
    | 'budget'
    | 'recurring'
    | 'user'
    | 'settings'
    | 'admin';

export interface AuditEntry {
    id: string;
    userId: string;
    action: AuditAction;
    entityType: AuditEntity;
    entityId?: string;
    previousData?: any;
    newData?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
}

export interface AuditLogInput {
    userId: string;
    action: AuditAction;
    entityType: AuditEntity;
    entityId?: string;
    previousData?: any;
    newData?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

export class AuditTrailService {
    /**
     * Log an audit entry
     * 
     * PURPOSE: This service is strictly for auditing DATA MUTATIONS (Create/Update/Delete).
     * For user session, access, and security events (Login/Logout/Failed Access), 
     * use ActivityLoggingService.
     */
    async log(input: AuditLogInput): Promise<string> {
        const { rows } = await pool.query(
            `INSERT INTO transaction_audit_log 
       (user_id, transaction_id, action, previous_data, new_data, changes, ip_address, user_agent, changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
            [
                input.userId,
                input.entityId,
                `${input.entityType}:${input.action}`,
                input.previousData ? JSON.stringify(input.previousData) : null,
                input.newData ? JSON.stringify(input.newData) : null,
                input.metadata ? JSON.stringify(input.metadata) : null,
                input.ipAddress,
                input.userAgent,
            ]
        );

        return rows[0].id;
    }

    /**
     * Log transaction change
     */
    async logTransactionChange(
        userId: string,
        transactionId: string,
        action: AuditAction,
        previousData?: any,
        newData?: any
    ): Promise<void> {
        const changes = this.calculateChanges(previousData, newData);

        await pool.query(
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
     * Log admin impersonation
     */
    async logImpersonation(adminId: string, targetUserId: string, ipAddress?: string): Promise<string> {
        return this.log({
            userId: adminId, // The admin doing the action
            action: 'impersonate',
            entityType: 'admin',
            entityId: targetUserId, // The user being impersonated
            metadata: { targetUserId },
            ipAddress,
            userAgent: 'Admin Console'
        });
    }

    /**
     * Get audit history for a specific entity
     */
    async getEntityHistory(userId: string, entityType: AuditEntity, entityId: string): Promise<AuditEntry[]> {
        const { rows } = await pool.query(
            `SELECT * FROM transaction_audit_log 
       WHERE user_id = $1 
       AND transaction_id = $2
       AND action LIKE $3
       ORDER BY changed_at DESC
       LIMIT 100`,
            [userId, entityId, `${entityType}:%`]
        );

        return rows.map(row => this.mapAuditRow(row));
    }

    /**
     * Get full audit log for a user
     */
    async getUserAuditLog(
        userId: string,
        filters?: {
            startDate?: string;
            endDate?: string;
            action?: AuditAction;
            entityType?: AuditEntity;
            limit?: number;
        }
    ): Promise<AuditEntry[]> {
        let query = `SELECT * FROM transaction_audit_log WHERE user_id = $1`;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (filters?.startDate) {
            query += ` AND changed_at >= $${paramIndex}`;
            params.push(filters.startDate);
            paramIndex++;
        }

        if (filters?.endDate) {
            query += ` AND changed_at <= $${paramIndex}`;
            params.push(filters.endDate);
            paramIndex++;
        }

        if (filters?.action) {
            query += ` AND action LIKE $${paramIndex}`;
            params.push(`%:${filters.action}`);
            paramIndex++;
        }

        if (filters?.entityType) {
            query += ` AND action LIKE $${paramIndex}`;
            params.push(`${filters.entityType}:%`);
            paramIndex++;
        }

        query += ` ORDER BY changed_at DESC LIMIT $${paramIndex}`;
        params.push(filters?.limit || 100);

        const { rows } = await pool.query(query, params);
        return rows.map(row => this.mapAuditRow(row));
    }

    /**
     * Get activity summary for dashboard
     */
    async getActivitySummary(userId: string, days: number = 7): Promise<{
        totalActions: number;
        byAction: Record<string, number>;
        byEntity: Record<string, number>;
        recentActivity: AuditEntry[];
    }> {
        const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');

        const { rows: countRows } = await pool.query(
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

        const { rows: recentRows } = await pool.query(
            `SELECT * FROM transaction_audit_log 
       WHERE user_id = $1 AND changed_at >= $2
       ORDER BY changed_at DESC
       LIMIT 10`,
            [userId, startDate]
        );

        const byAction: Record<string, number> = {};
        const byEntity: Record<string, number> = {};
        let totalActions = 0;

        countRows.forEach(row => {
            const [entityType, action] = row.action.split(':');
            byAction[action] = (byAction[action] || 0) + parseInt(row.count);
            byEntity[entityType] = (byEntity[entityType] || 0) + parseInt(row.count);
            totalActions += parseInt(row.count);
        });

        return {
            totalActions,
            byAction,
            byEntity,
            recentActivity: recentRows.map(row => this.mapAuditRow(row)),
        };
    }

    /**
     * Calculate differences between old and new data
     */
    private calculateChanges(previousData: any, newData: any): Record<string, { old: any; new: any }> {
        const changes: Record<string, { old: any; new: any }> = {};

        if (!previousData && !newData) return changes;
        if (!previousData) return { _created: { old: null, new: newData } };
        if (!newData) return { _deleted: { old: previousData, new: null } };

        const allKeys = new Set([...Object.keys(previousData), ...Object.keys(newData)]);

        allKeys.forEach(key => {
            if (JSON.stringify(previousData[key]) !== JSON.stringify(newData[key])) {
                changes[key] = {
                    old: previousData[key],
                    new: newData[key],
                };
            }
        });

        return changes;
    }

    private mapAuditRow(row: any): AuditEntry {
        const [entityType, action] = (row.action || ':').split(':');

        return {
            id: row.id,
            userId: row.user_id,
            action: action as AuditAction,
            entityType: entityType as AuditEntity,
            entityId: row.transaction_id,
            previousData: row.previous_data,
            newData: row.new_data,
            metadata: row.changes,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            createdAt: row.changed_at,
        };
    }
}

export const auditTrailService = new AuditTrailService();
