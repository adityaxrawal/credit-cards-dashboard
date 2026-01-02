import { ActivityLogRepository, ActivityLogRow } from '../../repositories/ActivityLogRepository';
import dayjs from 'dayjs';

/**
 * Activity Logging Service
 * Enhanced activity logging for user actions and system events
 */

export type ActivityType =
    | 'login'
    | 'logout'
    | 'session_refresh'
    | 'password_change'
    | 'email_change'
    | 'settings_update'
    | 'data_export'
    | 'data_import'
    | 'api_access'
    | 'failed_login'
    | 'suspicious_activity'
    | 'transaction_edit'
    | 'bulk_operation'
    | 'gmail_sync'
    | 'historical_scan';

export interface ActivityLog {
    id: string;
    userId: string;
    activityType: ActivityType;
    description: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: any;
    location?: any;
    createdAt: Date;
}

export interface ActivityLogInput {
    userId: string;
    activityType: ActivityType;
    description: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

export class ActivityLoggingService {
    /**
     * Log an activity
     * 
     * PURPOSE: This service is strictly for User Session & Security Events (Login, Logout, API Access).
     * For data mutation auditing (Changes to transactions, accounts, etc.), 
     * use AuditTrailService.
     */
    async logActivity(input: ActivityLogInput): Promise<string> {
        // Parse device info from user agent
        const deviceInfo = this.parseUserAgent(input.userAgent);

        const id = await ActivityLogRepository.create({
            userId: input.userId,
            activityType: input.activityType,
            description: input.description,
            metadata: input.metadata,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            deviceInfo,
        });

        // Check for suspicious patterns
        await this.checkSuspiciousActivity(input);

        return id;
    }

    /**
     * Log login attempt
     */
    async logLogin(userId: string, success: boolean, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.logActivity({
            userId,
            activityType: success ? 'login' : 'failed_login',
            description: success ? 'User logged in successfully' : 'Failed login attempt',
            metadata: { success },
            ipAddress,
            userAgent,
        });

        // Track failed login attempts
        if (!success) {
            await ActivityLogRepository.trackFailedLogin(userId, ipAddress);
        } else {
            // Clear failed login counter on success
            await ActivityLogRepository.clearFailedLogins(userId, ipAddress);
        }
    }

    /**
     * Log logout
     */
    async logLogout(userId: string, ipAddress?: string): Promise<void> {
        await this.logActivity({
            userId,
            activityType: 'logout',
            description: 'User logged out',
            ipAddress,
        });
    }

    /**
     * Log API access
     */
    async logApiAccess(
        userId: string,
        endpoint: string,
        method: string,
        statusCode: number,
        responseTime: number,
        ipAddress?: string
    ): Promise<void> {
        // Only log significant API calls (skip health checks, etc.)
        if (endpoint.includes('/health') || endpoint.includes('/monitoring')) {
            return;
        }

        await this.logActivity({
            userId,
            activityType: 'api_access',
            description: `${method} ${endpoint}`,
            metadata: { endpoint, method, statusCode, responseTime },
            ipAddress,
        });
    }

    /**
     * Log Gmail sync activity
     */
    async logGmailSync(
        userId: string,
        syncType: 'incremental' | 'historical',
        emailsProcessed: number,
        transactionsCreated: number
    ): Promise<void> {
        await this.logActivity({
            userId,
            activityType: 'gmail_sync',
            description: `Gmail ${syncType} sync completed`,
            metadata: { syncType, emailsProcessed, transactionsCreated },
        });
    }

    /**
     * Get user's activity log
     */
    async getActivityLog(
        userId: string,
        filters?: {
            activityType?: ActivityType;
            startDate?: string;
            endDate?: string;
            limit?: number;
        }
    ): Promise<ActivityLog[]> {
        const rows = await ActivityLogRepository.findByUserId(userId, {
            activityType: filters?.activityType,
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            limit: filters?.limit,
        });
        return rows.map(row => this.mapActivityRow(row));
    }

    /**
     * Get login history
     */
    async getLoginHistory(userId: string, limit: number = 10): Promise<ActivityLog[]> {
        const rows = await ActivityLogRepository.getLoginHistory(userId, limit);
        return rows.map(row => this.mapActivityRow(row));
    }

    /**
     * Get active sessions (based on login/logout pattern)
     */
    async getActiveSessions(userId: string): Promise<any[]> {
        const rows = await ActivityLogRepository.getActiveLoginSessions(userId);
        return rows.map(row => ({
            id: row.id,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            deviceInfo: row.device_info,
            loginTime: row.created_at,
        }));
    }

    /**
     * Get activity summary
     */
    async getActivitySummary(userId: string, days: number = 30): Promise<{
        totalActivities: number;
        byType: Record<string, number>;
        recentLogins: number;
        failedLogins: number;
        uniqueIps: number;
    }> {
        const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
        const rows = await ActivityLogRepository.getActivitySummary(userId, startDate);

        const byType: Record<string, number> = {};
        let totalActivities = 0;
        let uniqueIps = 0;
        let logins = 0;
        let failedLogins = 0;

        rows.forEach(row => {
            byType[row.activity_type] = parseInt(row.type_count);
            totalActivities += parseInt(row.type_count);
            uniqueIps = parseInt(row.unique_ips);
            if (row.activity_type === 'login') logins = parseInt(row.logins);
            if (row.activity_type === 'failed_login') failedLogins = parseInt(row.failed_logins);
        });

        return {
            totalActivities,
            byType,
            recentLogins: logins,
            failedLogins,
            uniqueIps,
        };
    }

    /**
     * Check for suspicious activity patterns
     */
    private async checkSuspiciousActivity(input: ActivityLogInput): Promise<void> {
        // Check for multiple failed logins
        if (input.activityType === 'failed_login') {
            const count = await ActivityLogRepository.countFailedLoginsInWindow(input.userId, 15);

            if (count >= 5) {
                await this.logActivity({
                    userId: input.userId,
                    activityType: 'suspicious_activity',
                    description: 'Multiple failed login attempts detected',
                    metadata: { failedAttempts: count, timeWindow: '15 minutes' },
                    ipAddress: input.ipAddress,
                });
            }
        }

        // Check for unusual location (new IP)
        if (input.activityType === 'login' && input.ipAddress) {
            const count = await ActivityLogRepository.countLoginsFromIp(input.userId, input.ipAddress);

            if (count === 0) {
                await this.logActivity({
                    userId: input.userId,
                    activityType: 'suspicious_activity',
                    description: 'Login from new IP address',
                    metadata: { newIpAddress: input.ipAddress },
                    ipAddress: input.ipAddress,
                });
            }
        }
    }

    private parseUserAgent(userAgent?: string): any {
        if (!userAgent) return null;

        // Simple user agent parsing
        const isBot = /bot|crawler|spider/i.test(userAgent);
        const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
        const browser = this.detectBrowser(userAgent);
        const os = this.detectOS(userAgent);

        return { isBot, isMobile, browser, os };
    }

    private detectBrowser(userAgent: string): string {
        if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) return 'Chrome';
        if (/firefox/i.test(userAgent)) return 'Firefox';
        if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
        if (/edge|edg/i.test(userAgent)) return 'Edge';
        if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';
        return 'Unknown';
    }

    private detectOS(userAgent: string): string {
        if (/windows/i.test(userAgent)) return 'Windows';
        if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
        if (/linux/i.test(userAgent)) return 'Linux';
        if (/android/i.test(userAgent)) return 'Android';
        if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
        return 'Unknown';
    }

    private mapActivityRow(row: ActivityLogRow): ActivityLog {
        return {
            id: row.id,
            userId: row.user_id,
            activityType: row.activity_type as ActivityType,
            description: row.description,
            metadata: row.metadata,
            ipAddress: row.ip_address ?? undefined,
            userAgent: row.user_agent ?? undefined,
            deviceInfo: row.device_info,
            createdAt: row.created_at,
        };
    }
}

export const activityLoggingService = new ActivityLoggingService();
