
import { Request, Response } from 'express';
import { PreferenceService } from '../user/preference.service';
import { BudgetRepository } from '../budget/budget.repository';
import { UserRepository } from '../user/user.repository';
import { TimezoneService, COMMON_TIMEZONES, DEFAULT_TIMEZONE } from '@shared/utils/helpers/TimezoneService';

export class SettingsController {

    /**
     * Get all user settings
     */
    static async getSettings(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const [preferences, monthlyBudget, userTimezone] = await Promise.all([
                PreferenceService.getPreferences(userId),
                BudgetRepository.getUserMonthlyBudget(userId),
                UserRepository.getUserTimezone(userId)
            ]);

            const settings = {
                monthly_budget: monthlyBudget,
                alert_threshold: preferences?.budgetWarningThreshold || 80,
                email_notifications: preferences?.emailEnabled ?? true,
                // These are now persisted
                notification_preferences: {
                    bill_reminders: !!(preferences?.billReminderDays), // Simplified mapping
                    payment_alerts: preferences?.paymentAlerts ?? true,
                    spending_alerts: preferences?.spendingAlerts ?? true,
                    weekly_summary: preferences?.weeklySummary ?? true
                },
                // Default values for fields not yet in Settings DB (some might be in other modules)
                theme: 'system',
                currency: 'INR', // This is handled by Currency module, but we provide a default here
                date_format: 'DD/MM/YYYY',
                auto_sync_enabled: true,
                // Timezone settings
                timezone: userTimezone || DEFAULT_TIMEZONE,
                available_timezones: COMMON_TIMEZONES
            };

            res.json({
                data: settings,
                updated_at: preferences?.updatedAt || new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
            res.status(500).json({ error: 'Failed to fetch settings' });
        }
    }

    /**
     * Update user settings
     */
    static async updateSettings(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const updates = req.body;
            const promises = [];

            // Update Budget if present
            if (updates.monthly_budget !== undefined) {
                promises.push(BudgetRepository.updateUserMonthlyBudget(userId, Number(updates.monthly_budget)));
            }

            // Update Timezone if present
            if (updates.timezone !== undefined) {
                // Validate timezone
                if (!TimezoneService.isValidTimezone(updates.timezone)) {
                    return res.status(400).json({ error: 'Invalid timezone' });
                }
                promises.push(UserRepository.updateTimezone(userId, updates.timezone));
            }

            // Update Preferences if present
            const prefUpdates: any = {};
            if (updates.alert_threshold !== undefined) prefUpdates.budgetWarningThreshold = updates.alert_threshold;
            if (updates.email_notifications !== undefined) prefUpdates.emailEnabled = updates.email_notifications;

            // Handle nested notification preferences
            if (updates.notification_preferences) {
                const notif = updates.notification_preferences;
                if (notif.spending_alerts !== undefined) prefUpdates.spendingAlerts = notif.spending_alerts;
                if (notif.weekly_summary !== undefined) prefUpdates.weeklySummary = notif.weekly_summary;
                if (notif.payment_alerts !== undefined) prefUpdates.paymentAlerts = notif.payment_alerts;

                // For bill reminders, if true, we ensure a default > 0 if not set. 
                // If false, we could set days to 0 or handle a separate flag.
                // For now, if we receive it, we assume standard behavior.
                // ideally we should accept `daily_limit` or `reminder_days` too.
            }

            if (Object.keys(prefUpdates).length > 0) {
                promises.push(PreferenceService.updatePreferences(userId, prefUpdates));
            }

            await Promise.all(promises);

            // Fetch fresh data to return
            return SettingsController.getSettings(req, res);
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    }

    /**
     * Reset settings to defaults
     */
    static async resetSettings(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            await Promise.all([
                PreferenceService.createDefaultPreferences(userId),
                // BudgetRepository doesn't strictly have a reset, but we could set it to 0 or leave it
                BudgetRepository.updateUserMonthlyBudget(userId, 0)
            ]);

            return SettingsController.getSettings(req, res);
        } catch (error) {
            console.error('Error resetting settings:', error);
            res.status(500).json({ error: 'Failed to reset settings' });
        }
    }
}
