import webpush from 'web-push';
import logger from '@shared/utils/infrastructure/logger';
import { NotificationRepository } from '../../repositories/NotificationRepository';

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    url?: string;
}

export class PushNotificationService {
    private static isConfigured = false;

    /**
     * Initialize web-push with VAPID keys
     */
    static initialize() {
        if (this.isConfigured) return;

        const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;

        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
            logger.warn('[PushNotificationService] VAPID configuration missing. Push notifications disabled.');
            this.isConfigured = false;
            return;
        }

        try {
            webpush.setVapidDetails(
                VAPID_SUBJECT,
                VAPID_PUBLIC_KEY,
                VAPID_PRIVATE_KEY
            );
            this.isConfigured = true;
            logger.info('[PushNotificationService] VAPID initialized');
        } catch (error) {
            logger.error('[PushNotificationService] Failed to initialize VAPID', error);
            this.isConfigured = false;
        }
    }

    /**
     * Send notification to a specific subscription
     */
    static async sendNotification(subscription: any, payload: PushPayload): Promise<boolean> {
        if (!this.isConfigured) {
            this.initialize();
            if (!this.isConfigured) return false;
        }

        try {
            await webpush.sendNotification(subscription, JSON.stringify(payload));
            return true;
        } catch (error: any) {
            if (error.statusCode === 410) {
                // Subscription has expired or is no longer valid
                logger.debug('[PushNotificationService] Subscription expired, removing...', { endpoint: subscription.endpoint });
                await NotificationRepository.deletePushSubscription(subscription.endpoint);
            } else {
                logger.error('[PushNotificationService] Failed to send notification', error);
            }
            return false;
        }
    }

    /**
     * Send notification to all of a user's devices
     */
    static async sendToUser(userId: string, payload: PushPayload): Promise<number> {
        try {
            const subscriptions = await NotificationRepository.getPushSubscriptions(userId);
            if (subscriptions.length === 0) return 0;

            const promises = subscriptions.map(sub => ({
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh_key,
                    auth: sub.auth_key
                }
            })).map(sub => this.sendNotification(sub, payload));

            const results = await Promise.all(promises);
            const successCount = results.filter(success => success).length;

            logger.info(`[PushNotificationService] Sent to ${successCount}/${subscriptions.length} devices for user ${userId}`);
            return successCount;
        } catch (error) {
            logger.error('[PushNotificationService] Error sending to user', error);
            return 0;
        }
    }

    /**
     * Send Large Transaction Alert
     */
    static async sendLargeTransactionAlert(
        userId: string,
        data: {
            amount: number;
            merchant: string;
        }
    ): Promise<boolean> {
        const formattedAmount = `₹${data.amount.toLocaleString('en-IN')}`;

        const payload: PushPayload = {
            title: 'Large Transaction Alert',
            body: `Transaction of ${formattedAmount} at ${data.merchant} detected.`,
            icon: '/icons/icon-192x192.png',
            url: '/transactions'
        };

        const sentCount = await this.sendToUser(userId, payload);
        return sentCount > 0;
    }
}
