/**
 * Unified Audit Service
 * Facade that provides a single entry point for all audit/logging operations
 * 
 * This service consolidates:
 * - SessionAuditService (formerly ActivityLoggingService) → Security events
 * - DataAuditService (formerly AuditTrailService) → Data mutations
 * 
 * Extracted as part of Issue #5 - Duplicate Audit/Activity Logging Systems
 */

import { ActivityLoggingService, ActivityType as ActivityEventType, activityLoggingService } from './activityLogging.service';
import { AuditTrailService, AuditAction, AuditEntity, auditTrailService } from './auditTrail.service';

// Unified event type enum combining both systems
export enum AuditEventType {
    // Session & Security Events (delegated to ActivityLoggingService)
    LOGIN = 'login',
    LOGOUT = 'logout',
    FAILED_LOGIN = 'failed_login',
    API_ACCESS = 'api_access',
    SESSION_CREATED = 'session_created',
    SESSION_EXPIRED = 'session_expired',

    // System Events (delegated to ActivityLoggingService)
    GMAIL_SYNC = 'gmail_sync',
    HISTORICAL_SCAN = 'historical_scan',
    EXPORT = 'export',
    IMPORT = 'import',

    // Data Mutation Events (delegated to AuditTrailService)
    TRANSACTION_CREATE = 'transaction_create',
    TRANSACTION_UPDATE = 'transaction_update',
    TRANSACTION_DELETE = 'transaction_delete',
    ACCOUNT_CREATE = 'account_create',
    ACCOUNT_UPDATE = 'account_update',
    ACCOUNT_DELETE = 'account_delete',
    CARD_CREATE = 'card_create',
    CARD_UPDATE = 'card_update',
    CARD_DELETE = 'card_delete',
    BUDGET_CREATE = 'budget_create',
    BUDGET_UPDATE = 'budget_update',
    BUDGET_DELETE = 'budget_delete',
    GOAL_CREATE = 'goal_create',
    GOAL_UPDATE = 'goal_update',
    GOAL_DELETE = 'goal_delete',
}

// Categorize events by handler
const sessionEvents = new Set([
    AuditEventType.LOGIN,
    AuditEventType.LOGOUT,
    AuditEventType.FAILED_LOGIN,
    AuditEventType.API_ACCESS,
    AuditEventType.SESSION_CREATED,
    AuditEventType.SESSION_EXPIRED,
    AuditEventType.GMAIL_SYNC,
    AuditEventType.HISTORICAL_SCAN,
    AuditEventType.EXPORT,
    AuditEventType.IMPORT,
]);

export interface UnifiedAuditInput {
    userId: string;
    eventType: AuditEventType;
    entityId?: string;
    description?: string;
    previousData?: any;
    newData?: any;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Unified Audit Service
 * 
 * Provides a single API for all audit logging while maintaining
 * the specialized underlying implementations.
 */
export class UnifiedAuditService {
    // Expose underlying services for advanced usage
    readonly session = activityLoggingService;
    readonly data = auditTrailService;

    /**
     * Log any audit event through unified interface
     */
    async log(input: UnifiedAuditInput): Promise<string> {
        if (sessionEvents.has(input.eventType)) {
            // Route to ActivityLoggingService
            return this.session.logActivity({
                userId: input.userId,
                activityType: this.mapToActivityType(input.eventType),
                description: input.description || `${input.eventType} event`,
                metadata: input.metadata,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            });
        } else {
            // Route to AuditTrailService
            const [entityType, action] = this.parseDataEvent(input.eventType);
            return this.data.log({
                userId: input.userId,
                action,
                entityType,
                entityId: input.entityId,
                previousData: input.previousData,
                newData: input.newData,
                metadata: input.metadata,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            });
        }
    }

    // ============================================
    // Convenience methods for common events
    // ============================================

    async logLogin(userId: string, success: boolean, ipAddress?: string, userAgent?: string) {
        return this.session.logLogin(userId, success, ipAddress, userAgent);
    }

    async logLogout(userId: string, ipAddress?: string) {
        return this.session.logLogout(userId, ipAddress);
    }

    async logApiAccess(userId: string, endpoint: string, method: string, statusCode: number, responseTime: number, ipAddress?: string) {
        return this.session.logApiAccess(userId, endpoint, method, statusCode, responseTime, ipAddress);
    }

    async logTransactionChange(userId: string, transactionId: string, action: AuditAction, previousData?: any, newData?: any) {
        return this.data.logTransactionChange(userId, transactionId, action, previousData, newData);
    }

    // ============================================
    // Unified query methods
    // ============================================

    /**
     * Get combined audit summary for dashboard
     */
    async getCombinedSummary(userId: string, days: number = 7) {
        const [sessionSummary, dataSummary] = await Promise.all([
            this.session.getActivitySummary(userId, days),
            this.data.getActivitySummary(userId, days),
        ]);

        return {
            session: sessionSummary,
            data: dataSummary,
            totalEvents: sessionSummary.totalActivities + dataSummary.totalActions,
        };
    }

    // ============================================
    // Helper methods
    // ============================================

    private mapToActivityType(eventType: AuditEventType): ActivityEventType {
        const mapping: Record<string, ActivityEventType> = {
            [AuditEventType.LOGIN]: 'login',
            [AuditEventType.LOGOUT]: 'logout',
            [AuditEventType.FAILED_LOGIN]: 'failed_login',
            [AuditEventType.API_ACCESS]: 'api_access',
            [AuditEventType.SESSION_CREATED]: 'login', // Map to login
            [AuditEventType.SESSION_EXPIRED]: 'logout', // Map to logout
            [AuditEventType.GMAIL_SYNC]: 'gmail_sync',
            [AuditEventType.HISTORICAL_SCAN]: 'historical_scan',
            [AuditEventType.EXPORT]: 'data_export',
            [AuditEventType.IMPORT]: 'data_import',
        };
        // Default only if not found (should cover all sessionEvents)
        return mapping[eventType] || 'suspicious_activity';
    }

    private parseDataEvent(eventType: AuditEventType): [AuditEntity, AuditAction] {
        const parts = eventType.split('_');
        const action = parts.pop() as AuditAction;
        const entity = parts.join('_') as AuditEntity;
        return [entity as AuditEntity, action];
    }
}

// Singleton export
export const auditService = new UnifiedAuditService();

// Re-export underlying services with clearer names for direct access
export { activityLoggingService as sessionAuditService } from './activityLogging.service';
export { auditTrailService as dataAuditService } from './auditTrail.service';
