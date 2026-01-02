import * as gmailClient from '@shared/infra/google/gmailClient';
import { env } from '@shared/config/env';
import { encrypt, decrypt } from '@shared/utils/helpers/encryption';
import { UserRepository } from '@modules/user/user.repository';

export class GmailConnectionService {
    /**
     * Get Gmail connection status for a user
     */
    static async getConnectionStatus(userId: string) {
        const user = await UserRepository.getGmailConnectionInfo(userId);

        if (!user) {
            return { connected: false };
        }

        const hasRefreshToken = !!user.google_refresh_token;
        const watchExpiration = user.gmail_watch_expiration
            ? new Date(user.gmail_watch_expiration)
            : null;
        const isWatchActive = watchExpiration && watchExpiration > new Date();

        return {
            connected: hasRefreshToken,
            watchActive: isWatchActive,
            watchExpiration,
            historyId: user.gmail_history_id,
        };
    }

    /**
     * Connect Gmail - store refresh token and setup watch
     */
    static async connect(userId: string, refreshToken: string) {
        console.log(`[GmailConnectionService] Connecting Gmail for user ${userId}`);

        // Store encrypted refresh token
        const encryptedToken = encrypt(refreshToken);
        await UserRepository.updateGmailToken(userId, encryptedToken);

        // Setup Gmail watch
        const topicName = env.GMAIL_PUBSUB_TOPIC || 'projects/YOUR_PROJECT/topics/gmail-notifications';
        const watchResult = await gmailClient.setupWatch(refreshToken, topicName);

        if (!watchResult) {
            throw new Error('Failed to setup Gmail watch');
        }

        // Update user with watch info
        const expiration = new Date(watchResult.expiration);
        await UserRepository.updateGmailWatch(userId, watchResult.historyId, expiration);

        return {
            connected: true,
            watchExpiration: expiration,
            historyId: watchResult.historyId,
        };
    }

    /**
     * Disconnect Gmail - stop watch and clear tokens
     */
    static async disconnect(userId: string) {
        const user = await UserRepository.getGmailConnectionInfo(userId);

        if (user?.google_refresh_token) {
            const rawToken = decrypt(user.google_refresh_token);
            await gmailClient.stopWatch(rawToken);
        }

        await UserRepository.clearGmailConnection(userId);

        return { connected: false };
    }

    /**
     * Get refresh token for a user (decrypted)
     */
    static async getRefreshToken(userId: string): Promise<string | null> {
        const user = await UserRepository.getGmailConnectionInfo(userId);

        if (!user?.google_refresh_token) {
            return null;
        }

        return decrypt(user.google_refresh_token);
    }
}
