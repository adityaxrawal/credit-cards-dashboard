import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

export class BillAlertsService {
    /**
     * Check for overdue bills and upcoming due dates
     */
    static async checkBillAlerts(): Promise<number> {
        let alertCount = 0;
        try {
            // 1. Check Overdue Bills
            const overdueResult = await pool.query(
                `SELECT b.id, b.user_id, b.name, b.amount, b.due_date 
                 FROM bills b
                 LEFT JOIN alerts a ON a.metadata->>'bill_id' = b.id::text AND a.alert_type = 'bill_overdue'
                 WHERE b.status = 'pending' 
                   AND b.due_date < CURRENT_DATE
                   AND a.id IS NULL` // Avoid duplicate alerts
            );

            for (const bill of overdueResult.rows) {
                await this.createAlert(
                    bill.user_id,
                    'bill_overdue',
                    'high',
                    `Bill Overdue: ${bill.name}`,
                    `You have an overdue bill of ₹${bill.amount} due on ${new Date(bill.due_date).toDateString()}`,
                    { bill_id: bill.id, bill_amount: bill.amount }
                );
                alertCount++;
            }

            // 2. Check Upcoming Bills (Due in 3 days)
            const upcomingResult = await pool.query(
                `SELECT b.id, b.user_id, b.name, b.amount, b.due_date 
                 FROM bills b
                 LEFT JOIN alerts a ON a.metadata->>'bill_id' = b.id::text AND a.alert_type = 'bill_upcoming'
                 WHERE b.status = 'pending' 
                   AND b.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '3 days')
                   AND a.id IS NULL`
            );

            for (const bill of upcomingResult.rows) {
                await this.createAlert(
                    bill.user_id,
                    'bill_upcoming',
                    'medium',
                    `Upcoming Bill: ${bill.name}`,
                    `Your bill of ₹${bill.amount} is due on ${new Date(bill.due_date).toDateString()}`,
                    { bill_id: bill.id, bill_amount: bill.amount }
                );
                alertCount++;
            }

            return alertCount;
        } catch (error) {
            logger.error('[BillAlerts] Failed to check bill alerts:', error);
            return 0;
        }
    }

    /**
     * Check for upcoming subscription renewals
     */
    static async checkSubscriptionRenewals(): Promise<number> {
        let alertCount = 0;
        try {
            // Check active subscriptions renewing in 2 days
            const renewalsResult = await pool.query(
                `SELECT id, user_id, merchant_normalized, typical_amount, next_expected
                 FROM recurring_patterns
                 WHERE status = 'active'
                   AND is_subscription = true
                   AND next_expected BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '2 days')
                   AND NOT EXISTS (
                       SELECT 1 FROM alerts 
                       WHERE metadata->>'subscription_id' = recurring_patterns.id::text 
                         AND alert_type = 'subscription_renewal'
                         AND created_at > (CURRENT_DATE - INTERVAL '5 days')
                   )`
            );

            for (const sub of renewalsResult.rows) {
                await this.createAlert(
                    sub.user_id,
                    'subscription_renewal',
                    'low',
                    `Subscription Renewal: ${sub.merchant_normalized}`,
                    `Your subscription for ${sub.merchant_normalized} (~₹${sub.typical_amount}) is renewing soon on ${new Date(sub.next_expected).toDateString()}`,
                    { subscription_id: sub.id, amount: sub.typical_amount }
                );
                alertCount++;
            }

            return alertCount;
        } catch (error) {
            logger.error('[BillAlerts] Failed to check subscription alerts:', error);
            return 0;
        }
    }

    private static async createAlert(
        userId: string,
        type: string,
        priority: string,
        title: string,
        message: string,
        metadata: any
    ) {
        await pool.query(
            `INSERT INTO alerts (
                user_id, alert_type, priority, title, message, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [userId, type, priority, title, message, JSON.stringify(metadata)]
        );
    }
}
