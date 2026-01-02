/**
 * Bill Alerts Repository
 * Data access layer for bill alerts and reminders
 */

import { query } from '../lib/db';

export interface BillRow {
    id: string;
    user_id: string;
    name: string;
    amount: number;
    due_date: Date;
}

export interface SubscriptionRow {
    id: string;
    user_id: string;
    merchant_normalized: string;
    typical_amount: number;
    next_expected: Date;
}

export class BillAlertsRepository {
    /**
     * Get overdue bills without existing alerts
     */
    static async getOverdueBillsWithoutAlerts(): Promise<BillRow[]> {
        const result = await query(
            `SELECT b.id, b.user_id, b.name, b.amount, b.due_date 
             FROM bills b
             LEFT JOIN alerts a ON a.metadata->>'bill_id' = b.id::text AND a.alert_type = 'bill_overdue'
             WHERE b.status = 'pending' 
               AND b.due_date < CURRENT_DATE
               AND a.id IS NULL`
        );
        return result.rows;
    }

    /**
     * Get upcoming bills (due in N days) without existing alerts
     */
    static async getUpcomingBillsWithoutAlerts(daysAhead: number = 3): Promise<BillRow[]> {
        const result = await query(
            `SELECT b.id, b.user_id, b.name, b.amount, b.due_date 
             FROM bills b
             LEFT JOIN alerts a ON a.metadata->>'bill_id' = b.id::text AND a.alert_type = 'bill_upcoming'
             WHERE b.status = 'pending' 
               AND b.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${daysAhead} days')
               AND a.id IS NULL`
        );
        return result.rows;
    }

    /**
     * Get subscriptions renewing soon without recent alerts
     */
    static async getUpcomingSubscriptionRenewals(daysAhead: number = 2): Promise<SubscriptionRow[]> {
        const result = await query(
            `SELECT id, user_id, merchant_normalized, typical_amount, next_expected
             FROM recurring_patterns
             WHERE status = 'active'
               AND is_subscription = true
               AND next_expected BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${daysAhead} days')
               AND NOT EXISTS (
                   SELECT 1 FROM alerts 
                   WHERE metadata->>'subscription_id' = recurring_patterns.id::text 
                     AND alert_type = 'subscription_renewal'
                     AND created_at > (CURRENT_DATE - INTERVAL '5 days')
               )`
        );
        return result.rows;
    }

    /**
     * Create an alert
     */
    static async createAlert(
        userId: string,
        type: string,
        priority: string,
        title: string,
        message: string,
        metadata: any
    ): Promise<void> {
        await query(
            `INSERT INTO alerts (
                user_id, alert_type, priority, title, message, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [userId, type, priority, title, message, JSON.stringify(metadata)]
        );
    }
}
