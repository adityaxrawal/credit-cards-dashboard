/**
 * Notification Repository
 * Data access layer for notification preferences and logs
 */

import { query } from '@shared/database/db';

export interface NotificationPreferenceRow {
    id: string;
    user_id: string;
    email_enabled: boolean;
    push_enabled: boolean;
    large_transaction_threshold: number;
    budget_warning_threshold: number;
    bill_reminder_days: number;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    created_at: Date;
    updated_at: Date;
    spending_alerts: boolean;
    weekly_summary: boolean;
    payment_alerts: boolean;
}

export class NotificationRepository {
    /**
     * Get user notification preferences
     */
    static async getPreferences(userId: string): Promise<NotificationPreferenceRow | null> {
        const result = await query(
            `SELECT * FROM notification_preferences WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Create default preferences
     */
    static async createDefaultPreferences(userId: string): Promise<NotificationPreferenceRow> {
        const result = await query(
            `INSERT INTO notification_preferences (
                user_id, 
                email_enabled, 
                push_enabled, 
                large_transaction_threshold,
                budget_warning_threshold,
                bill_reminder_days,
                spending_alerts,
                weekly_summary,
                payment_alerts
            ) VALUES ($1, true, true, 10000, 80, 3, true, true, true)
            ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
            RETURNING *`,
            [userId]
        );
        return result.rows[0];
    }

    /**
     * Update preferences with dynamic fields
     */
    static async updatePreferences(
        userId: string,
        setClause: string,
        params: any[]
    ): Promise<NotificationPreferenceRow | null> {
        const result = await query(
            `UPDATE notification_preferences 
             SET ${setClause} 
             WHERE user_id = $1 
             RETURNING *`,
            params
        );
        return result.rows[0] || null;
    }

    /**
     * Get user email
     */
    static async getUserEmail(userId: string): Promise<string | null> {
        const result = await query(
            `SELECT email FROM users WHERE id = $1`,
            [userId]
        );
        return result.rows[0]?.email || null;
    }

    /**
     * Get user push subscriptions
     */
    static async getPushSubscriptions(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = $1`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Log a notification alert
     */
    static async logAlert(
        userId: string,
        alertType: string,
        details: Record<string, any>
    ): Promise<void> {
        await query(
            `INSERT INTO notification_logs (user_id, alert_type, details, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT DO NOTHING`,
            [userId, alertType, JSON.stringify(details)]
        );
    }
    /**
     * Delete a push subscription (e.g. when expired/410)
     */
    static async deletePushSubscription(endpoint: string): Promise<void> {
        await query(
            `DELETE FROM push_subscriptions WHERE endpoint = $1`,
            [endpoint]
        );
    }
}
