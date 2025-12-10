import * as gmailClient from '../lib/gmailClient';
import pool from '../lib/db';
import { FastQueueService } from './FastQueueService';

/**
 * Fetcher Service
 * 
 * Logic:
 * 1. Receive PubSub notification (historyID).
 * 2. Fetch incremental history (minimal).
 * 3. Extract messageIds.
 * 4. Fetch Snippets/Headers (Batch).
 * 5. Enqueue into FastQueue.
 */
export class FetcherService {

    static async handleNotification(userId: string, historyId: string) {
        // 1. Get user tokens
        const { rows } = await pool.query(
            'SELECT google_refresh_token, gmail_history_id FROM users WHERE id = $1',
            [userId]
        );
        if (rows.length === 0 || !rows[0].google_refresh_token) {
            console.warn('[Fetcher] User not found or not connected', userId);
            return;
        }
        const refreshToken = rows[0].google_refresh_token;
        const startHistoryId = rows[0].gmail_history_id || historyId; // Fallback

        try {
            // 2. Fetch History List
            // We want messages added.
            const history = await gmailClient.fetchHistory(refreshToken, startHistoryId);

            // 3. Extract Message IDs (Added only)
            const messageIds = new Set<string>();

            if (history.messages) {
                for (const msg of history.messages) {
                    messageIds.add(msg.id);
                }
            }

            if (messageIds.size === 0) return;

            console.log(`[Fetcher] Found ${messageIds.size} new messages`);

            // 4. Batch Fetch Minimal (Push to FastQueue)
            // We fetch the full format needed for Detection, but parallelize it.
            // Or we can just fetch snippet/headers.
            // CreditCardMailDetector.detect expects gmail_v1.Schema$Message.
            // gmailClient.batchGetMessages does exactly this.

            const idsList = Array.from(messageIds);
            const messages = await gmailClient.batchGetMessages(refreshToken, idsList);

            // 5. Enqueue
            for (const msg of messages) {
                if (msg) {
                    FastQueueService.enqueue(userId, msg);
                }
            }

            // 6. Update user historyId (Cursor)
            await pool.query('UPDATE users SET gmail_history_id = $1 WHERE id = $2', [historyId, userId]);

        } catch (error) {
            console.error('[Fetcher] Error processing notification:', error);
        }
    }
}
