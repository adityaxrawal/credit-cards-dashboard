/**
 * Preference Service
 * Manages user notification preferences and settings
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

export interface NotificationPreferences {
    id: string;
    userId: string;
    emailEnabled: boolean;
    pushEnabled: boolean;
    largeTransactionThreshold: number;
    budgetWarningThreshold: number;
    billReminderDays: number;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class PreferenceService {
    /**
     * Get user notification preferences
     */
    static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
        const result = await pool.query(
            `SELECT * FROM notification_preferences WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            // Create default preferences
            return this.createDefaultPreferences(userId);
        }

        return this.mapRowToPreferences(result.rows[0]);
    }

    /**
     * Create default preferences for a user
     */
    static async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
        const result = await pool.query(
            `INSERT INTO notification_preferences (
                user_id, 
                email_enabled, 
                push_enabled, 
                large_transaction_threshold,
                budget_warning_threshold,
                bill_reminder_days
            ) VALUES ($1, true, true, 10000, 80, 3)
            ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
            RETURNING *`,
            [userId]
        );

        return this.mapRowToPreferences(result.rows[0]);
    }

    /**
     * Update notification preferences
     */
    static async updatePreferences(
        userId: string,
        updates: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
    ): Promise<NotificationPreferences> {
        const setClause: string[] = [];
        const params: any[] = [userId];
        let paramIndex = 2;

        if (updates.emailEnabled !== undefined) {
            setClause.push(`email_enabled = $${paramIndex++}`);
            params.push(updates.emailEnabled);
        }
        if (updates.pushEnabled !== undefined) {
            setClause.push(`push_enabled = $${paramIndex++}`);
            params.push(updates.pushEnabled);
        }
        if (updates.largeTransactionThreshold !== undefined) {
            setClause.push(`large_transaction_threshold = $${paramIndex++}`);
            params.push(updates.largeTransactionThreshold);
        }
        if (updates.budgetWarningThreshold !== undefined) {
            setClause.push(`budget_warning_threshold = $${paramIndex++}`);
            params.push(updates.budgetWarningThreshold);
        }
        if (updates.billReminderDays !== undefined) {
            setClause.push(`bill_reminder_days = $${paramIndex++}`);
            params.push(updates.billReminderDays);
        }
        if (updates.quietHoursStart !== undefined) {
            setClause.push(`quiet_hours_start = $${paramIndex++}`);
            params.push(updates.quietHoursStart);
        }
        if (updates.quietHoursEnd !== undefined) {
            setClause.push(`quiet_hours_end = $${paramIndex++}`);
            params.push(updates.quietHoursEnd);
        }

        setClause.push('updated_at = NOW()');

        const result = await pool.query(
            `UPDATE notification_preferences 
             SET ${setClause.join(', ')} 
             WHERE user_id = $1 
             RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            // Create if doesn't exist
            return this.createDefaultPreferences(userId);
        }

        return this.mapRowToPreferences(result.rows[0]);
    }

    /**
     * Check if a transaction amount exceeds user's threshold
     */
    static async shouldAlertForTransaction(
        userId: string,
        amount: number
    ): Promise<boolean> {
        const prefs = await this.getPreferences(userId);
        if (!prefs) return false;

        return amount >= prefs.largeTransactionThreshold;
    }

    /**
     * Check if current time is within quiet hours
     */
    static async isQuietHours(userId: string): Promise<boolean> {
        const prefs = await this.getPreferences(userId);
        if (!prefs || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
            return false;
        }

        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const start = prefs.quietHoursStart;
        const end = prefs.quietHoursEnd;

        // Handle overnight quiet hours (e.g., 22:00 to 06:00)
        if (start > end) {
            return currentTime >= start || currentTime <= end;
        }

        return currentTime >= start && currentTime <= end;
    }

    /**
     * Map database row to preferences object
     */
    private static mapRowToPreferences(row: any): NotificationPreferences {
        return {
            id: row.id,
            userId: row.user_id,
            emailEnabled: row.email_enabled,
            pushEnabled: row.push_enabled,
            largeTransactionThreshold: row.large_transaction_threshold,
            budgetWarningThreshold: row.budget_warning_threshold,
            billReminderDays: row.bill_reminder_days,
            quietHoursStart: row.quiet_hours_start,
            quietHoursEnd: row.quiet_hours_end,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    /**
     * Trigger large transaction alert
     * Called when a transaction exceeds the user's threshold
     */
    static async triggerLargeTransactionAlert(
        userId: string,
        transaction: {
            id: string;
            amount: number;
            merchant: string;
            transactionDate: Date;
            instrumentType?: string;
        }
    ): Promise<{ emailSent: boolean; pushSent: boolean }> {
        const prefs = await this.getPreferences(userId);
        if (!prefs) {
            return { emailSent: false, pushSent: false };
        }

        // Check if amount exceeds threshold
        if (transaction.amount < prefs.largeTransactionThreshold) {
            return { emailSent: false, pushSent: false };
        }

        // Check if in quiet hours
        if (await this.isQuietHours(userId)) {
            logger.info(`Skipping alert for user ${userId} - quiet hours active`);
            // Queue for later instead (not implemented yet)
            return { emailSent: false, pushSent: false };
        }

        let emailSent = false;
        let pushSent = false;

        // Send email notification
        if (prefs.emailEnabled) {
            emailSent = await this.sendLargeTransactionEmail(userId, transaction, prefs);
        }

        // Send push notification
        if (prefs.pushEnabled) {
            pushSent = await this.sendLargeTransactionPush(userId, transaction, prefs);
        }

        // Log the alert
        await this.logAlert(userId, 'large_transaction', {
            transactionId: transaction.id,
            amount: transaction.amount,
            merchant: transaction.merchant,
            threshold: prefs.largeTransactionThreshold,
            emailSent,
            pushSent,
        });

        return { emailSent, pushSent };
    }

    /**
     * Send email for large transaction alert
     */
    private static async sendLargeTransactionEmail(
        userId: string,
        transaction: { amount: number; merchant: string; transactionDate: Date },
        prefs: NotificationPreferences
    ): Promise<boolean> {
        try {
            // Get user email
            const userResult = await pool.query(
                `SELECT email FROM users WHERE id = $1`,
                [userId]
            );

            if (userResult.rows.length === 0) return false;

            const email = userResult.rows[0].email;
            const formattedAmount = `₹${transaction.amount.toLocaleString('en-IN')}`;

            // Log for now - in production, integrate with email service
            logger.info(`[EMAIL ALERT] To: ${email} - Large transaction of ${formattedAmount} at ${transaction.merchant}`);

            // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
            // await emailService.send({
            //     to: email,
            //     subject: `Large Transaction Alert: ${formattedAmount}`,
            //     body: `A transaction of ${formattedAmount} was made at ${transaction.merchant}`
            // });

            return true;
        } catch (error) {
            logger.error('Failed to send large transaction email', error);
            return false;
        }
    }

    /**
     * Send push notification for large transaction alert
     */
    private static async sendLargeTransactionPush(
        userId: string,
        transaction: { amount: number; merchant: string },
        prefs: NotificationPreferences
    ): Promise<boolean> {
        try {
            // Get user's push subscriptions
            const subsResult = await pool.query(
                `SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = $1`,
                [userId]
            );

            if (subsResult.rows.length === 0) return false;

            const formattedAmount = `₹${transaction.amount.toLocaleString('en-IN')}`;

            // Log for now - in production, use web-push library
            logger.info(`[PUSH ALERT] User: ${userId} - Large transaction of ${formattedAmount} at ${transaction.merchant}`);

            // TODO: Integrate with web-push
            // for (const sub of subsResult.rows) {
            //     await webpush.sendNotification(sub, JSON.stringify({
            //         title: 'Large Transaction Alert',
            //         body: `${formattedAmount} at ${transaction.merchant}`,
            //         icon: '/icons/alert.png'
            //     }));
            // }

            return true;
        } catch (error) {
            logger.error('Failed to send large transaction push', error);
            return false;
        }
    }

    /**
     * Log alert for audit trail
     */
    private static async logAlert(
        userId: string,
        alertType: string,
        details: Record<string, any>
    ): Promise<void> {
        try {
            await pool.query(
                `INSERT INTO notification_logs (user_id, alert_type, details, created_at)
                 VALUES ($1, $2, $3, NOW())
                 ON CONFLICT DO NOTHING`,
                [userId, alertType, JSON.stringify(details)]
            );
        } catch (error) {
            // Non-critical - just log the error
            logger.warn('Failed to log alert', error);
        }
    }
}

