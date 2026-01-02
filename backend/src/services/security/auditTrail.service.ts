import { AuditTrailRepository, AuditTrailRow } from '../../repositories/AuditTrailRepository';
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
        return AuditTrailRepository.create({
            userId: input.userId,
            entityId: input.entityId,
            action: `${input.entityType}:${input.action}`,
            previousData: input.previousData,
            newData: input.newData,
            changes: input.metadata,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
        });
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

        await AuditTrailRepository.logTransactionChange(
            userId,
            transactionId,
            action,
            previousData,
            newData,
            changes
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
        const rows = await AuditTrailRepository.getEntityHistory(userId, entityId, entityType);
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
        const rows = await AuditTrailRepository.findByUserId(userId, {
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            action: filters?.action,
            entityType: filters?.entityType,
            limit: filters?.limit,
        });
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

        const countRows = await AuditTrailRepository.getActivityCounts(userId, startDate);
        const recentRows = await AuditTrailRepository.getRecent(userId, startDate, 10);

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

    private mapAuditRow(row: AuditTrailRow): AuditEntry {
        const [entityType, action] = (row.action || ':').split(':');

        return {
            id: row.id,
            userId: row.user_id,
            action: action as AuditAction,
            entityType: entityType as AuditEntity,
            entityId: row.transaction_id ?? undefined,
            previousData: row.previous_data,
            newData: row.new_data,
            metadata: row.changes,
            ipAddress: row.ip_address ?? undefined,
            userAgent: row.user_agent ?? undefined,
            createdAt: row.changed_at,
        };
    }
}

export const auditTrailService = new AuditTrailService();
