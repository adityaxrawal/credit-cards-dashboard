/**
 * Activity Log Repository
 * Data access layer for user activity logs
 */

import { query } from '../lib/db';

export interface ActivityLogRow {
    id: string;
    user_id: string;
    activity_type: string;
    description: string;
    metadata: any;
    ip_address: string | null;
    user_agent: string | null;
    device_info: any;
    location: any;
    created_at: Date;
}

export interface CreateActivityLogData {
    userId: string;
    activityType: string;
    description: string;
    metadata?: any;
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceInfo?: any;
}

export interface ActivityLogFilters {
    activityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
}

export class ActivityLogRepository {
    /**
     * Create a new activity log entry
     */
    static async create(data: CreateActivityLogData): Promise<string> {
        const result = await query(
            `INSERT INTO user_activity_log 
             (user_id, activity_type, description, metadata, ip_address, user_agent, device_info, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             RETURNING id`,
            [
                data.userId,
                data.activityType,
                data.description,
                data.metadata ? JSON.stringify(data.metadata) : null,
                data.ipAddress,
                data.userAgent,
                data.deviceInfo ? JSON.stringify(data.deviceInfo) : null,
            ]
        );
        return result.rows[0].id;
    }

    /**
     * Find activity logs by user ID with filters
     */
    static async findByUserId(userId: string, filters?: ActivityLogFilters): Promise<ActivityLogRow[]> {
        let sql = `SELECT * FROM user_activity_log WHERE user_id = $1`;
        const params: any[] = [userId];
        let paramIndex = 2;

        if (filters?.activityType) {
            sql += ` AND activity_type = $${paramIndex}`;
            params.push(filters.activityType);
            paramIndex++;
        }

        if (filters?.startDate) {
            sql += ` AND created_at >= $${paramIndex}`;
            params.push(filters.startDate);
            paramIndex++;
        }

        if (filters?.endDate) {
            sql += ` AND created_at <= $${paramIndex}`;
            params.push(filters.endDate);
            paramIndex++;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
        params.push(filters?.limit || 50);

        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get login history for a user
     */
    static async getLoginHistory(userId: string, limit: number = 10): Promise<ActivityLogRow[]> {
        const result = await query(
            `SELECT * FROM user_activity_log 
             WHERE user_id = $1 AND activity_type IN ('login', 'failed_login', 'logout')
             ORDER BY created_at DESC
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }

    /**
     * Get active sessions based on login events
     */
    static async getActiveLoginSessions(userId: string): Promise<ActivityLogRow[]> {
        const result = await query(
            `WITH login_events AS (
                SELECT id, ip_address, user_agent, device_info, created_at,
                       ROW_NUMBER() OVER (PARTITION BY ip_address ORDER BY created_at DESC) as rn
                FROM user_activity_log
                WHERE user_id = $1 AND activity_type = 'login'
                AND created_at >= NOW() - INTERVAL '7 days'
            )
            SELECT * FROM login_events
            WHERE rn = 1
            ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get activity summary for a user
     */
    static async getActivitySummary(userId: string, startDate: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT ip_address) as unique_ips,
                COUNT(*) FILTER (WHERE activity_type = 'login') as logins,
                COUNT(*) FILTER (WHERE activity_type = 'failed_login') as failed_logins,
                activity_type,
                COUNT(*) as type_count
             FROM user_activity_log
             WHERE user_id = $1 AND created_at >= $2
             GROUP BY activity_type`,
            [userId, startDate]
        );
        return result.rows;
    }

    /**
     * Count failed logins in time window
     */
    static async countFailedLoginsInWindow(userId: string, minutes: number = 15): Promise<number> {
        const result = await query(
            `SELECT COUNT(*) as count FROM user_activity_log
             WHERE user_id = $1 
             AND activity_type = 'failed_login'
             AND created_at >= NOW() - INTERVAL '${minutes} minutes'`,
            [userId]
        );
        return parseInt(result.rows[0].count);
    }

    /**
     * Count logins from IP address
     */
    static async countLoginsFromIp(userId: string, ipAddress: string): Promise<number> {
        const result = await query(
            `SELECT COUNT(*) as count FROM user_activity_log
             WHERE user_id = $1 
             AND ip_address = $2
             AND activity_type = 'login'`,
            [userId, ipAddress]
        );
        return parseInt(result.rows[0].count);
    }

    /**
     * Track failed login attempt
     */
    static async trackFailedLogin(userId: string, ipAddress?: string): Promise<void> {
        await query(
            `INSERT INTO failed_login_attempts (user_id, ip_address, attempted_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT DO NOTHING`,
            [userId, ipAddress]
        );
    }

    /**
     * Clear failed login attempts
     */
    static async clearFailedLogins(userId: string, ipAddress?: string): Promise<void> {
        await query(
            `DELETE FROM failed_login_attempts 
             WHERE user_id = $1 AND (ip_address = $2 OR ip_address IS NULL)`,
            [userId, ipAddress]
        );
    }
}
