/**
 * Notification Queue Processor Job
 * Processes queued notifications when quiet hours end
 */

import { NotificationRepository } from '../repositories/NotificationRepository';
import { NotificationQueueRepository } from '../repositories/NotificationQueueRepository';
import { PreferenceService } from '../services/notifications/PreferenceService';
import { EmailService } from '../services/notifications/EmailService';
import { PushNotificationService } from '../services/notifications/PushNotificationService';
import logger from '../utils/infrastructure/logger';
import dayjs from 'dayjs';

export const processNotificationQueue = async () => {
    logger.info('Starting notification queue processing...');

    try {
        // Get pending notifications
        const pendingItems = await NotificationQueueRepository.getPendingNotifications(50);

        if (pendingItems.length === 0) {
            logger.info('No pending notifications in queue');
            return;
        }

        logger.info(`Found ${pendingItems.length} pending notifications`);

        for (const item of pendingItems) {
            try {
                // Check if quiet hours are still active
                const isQuietHours = await PreferenceService.isQuietHours(item.userId);

                if (isQuietHours) {
                    // Still in quiet hours, skip
                    continue;
                }

                logger.info(`Processing queued notification ${item.id} for user ${item.userId}`);

                // Process based on type
                let success = false;

                if (item.type === 'large_transaction') {
                    success = await processLargeTransactionAlert(item.userId, item.payload);
                } else {
                    logger.warn(`Unknown notification type: ${item.type}`);
                    // Mark as failed so we don't retry indefinitely
                    await NotificationQueueRepository.markAsFailed(item.id);
                    continue;
                }

                if (success) {
                    await NotificationQueueRepository.markAsProcessed(item.id);
                    logger.info(`Successfully processed notification ${item.id}`);
                } else {
                    await NotificationQueueRepository.markAsFailed(item.id);
                    logger.error(`Failed to send notification ${item.id}`);
                }

            } catch (error) {
                logger.error(`Error processing notification ${item.id}`, error);
                await NotificationQueueRepository.markAsFailed(item.id);
            }
        }
    } catch (error) {
        logger.error('Error in notification queue processor', error);
    }
};

/**
 * Process large transaction alert
 */
async function processLargeTransactionAlert(userId: string, payload: any): Promise<boolean> {
    const { transaction, prefs } = payload;

    // Add a note that this was delayed
    const delayedNote = `(Delayed from quiet hours)`;

    let emailSent = false;
    let pushSent = false;

    // Send email
    // Note: We might want to indicate it was delayed in the email/push content
    // For now, we reuse existing logic but we need to duplicate some logic from PreferenceService
    // because PreferenceService.triggerLargeTransactionAlert checks thresholds/quiet hours again.

    // We can use the lower level services directly.

    if (prefs.emailEnabled) {
        try {
            // Get email address
            const emailAddress = await NotificationRepository.getUserEmail(userId);

            if (emailAddress) {
                emailSent = await EmailService.sendLargeTransactionAlert(emailAddress, {
                    amount: transaction.amount,
                    merchant: transaction.merchant,
                    date: new Date(transaction.transactionDate), // Ensure Date object
                    threshold: prefs.largeTransactionThreshold
                });
            }
        } catch (err) {
            logger.error('Failed to send email from queue', err);
        }
    }

    if (prefs.pushEnabled) {
        try {
            pushSent = await PushNotificationService.sendLargeTransactionAlert(userId, {
                amount: transaction.amount,
                merchant: transaction.merchant
            });
        } catch (err) {
            logger.error('Failed to send push from queue', err);
        }
    }

    return emailSent || pushSent;
}
