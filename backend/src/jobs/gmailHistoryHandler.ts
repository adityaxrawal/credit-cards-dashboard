import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { CreditCardMailDetector } from '../services/CreditCardMailDetector';
import * as scannedEmailQueries from '../db/queries/scanned_emails.queries';

/**
 * Gmail History Handler
 * 
 * Handles incremental sync using Gmail History API.
 * Called on Pub/Sub notifications or manual trigger.
 */
export async function processHistoryChanges(
    userId: string,
    lastHistoryId: string
): Promise<{
    processed: number;
    transactions: number;
    newHistoryId?: string;
    requiresFullResync: boolean;
}> {
    console.log(`[HistoryHandler] Processing history for user ${userId} from historyId ${lastHistoryId}`);

    try {
        // 1. Get user's refresh token
        const { rows: users } = await pool.query(
            'SELECT google_refresh_token FROM users WHERE id = $1',
            [userId]
        );

        if (users.length === 0 || !users[0].google_refresh_token) {
            throw new Error('User not found or Gmail not connected');
        }

        const refreshToken = users[0].google_refresh_token;

        // 2. Fetch history changes
        const history = await gmailClient.fetchHistory(refreshToken, lastHistoryId);

        // 3. Check for history gap
        if (history.hasGap) {
            console.warn('[HistoryHandler] History gap detected - triggering full resync');
            return {
                processed: 0,
                transactions: 0,
                requiresFullResync: true
            };
        }

        if (history.messages.length === 0) {
            console.log('[HistoryHandler] No new messages in history');
            return {
                processed: 0,
                transactions: 0,
                newHistoryId: history.historyId,
                requiresFullResync: false
            };
        }

        console.log(`[HistoryHandler] Found ${history.messages.length} new messages`);

        // 4. Filter for bank sender domains
        const { default: pLimit } = await import('p-limit');
        const limit = pLimit(5);

        let processed = 0;
        let transactions = 0;

        // 5. Process each new message
        const tasks = history.messages.map(msg => limit(async () => {
            try {
                // Check idempotency
                const exists = await gmailClient.isMessageProcessed(userId, msg.id, pool);
                if (exists) {
                    console.log(`[HistoryHandler] Skipping already processed message ${msg.id}`);
                    return;
                }

                // Fetch raw message
                const rawMessage = await gmailClient.getRawMessage(refreshToken, msg.id);
                if (!rawMessage) {
                    console.error(`[HistoryHandler] Failed to fetch message ${msg.id}`);
                    return;
                }

                // Check if from bank sender
                const headers = rawMessage.payload?.headers || [];
                const from = headers.find(h => h.name === 'From')?.value || '';
                const isBankSender = CreditCardMailDetector.SENDER_DOMAINS.some(
                    domain => from.toLowerCase().includes(domain)
                );

                if (!isBankSender) {
                    console.log(`[HistoryHandler] Skipping non-bank message ${msg.id}`);
                    return;
                }

                // ML Detection
                const detection = await CreditCardMailDetector.detect(rawMessage);

                // Extract headers for storage
                const subject = headers.find(h => h.name === 'Subject')?.value || '';
                const snippet = rawMessage.snippet || '';
                const internalDate = parseInt(rawMessage.internalDate || '0');

                // Save to database
                await scannedEmailQueries.insertScannedEmail({
                    userId,
                    messageId: msg.id,
                    internalDate,
                    subject,
                    sender: from,
                    snippet,
                    cleanedText: detection.cleanedText || '',
                    mlIsTransaction: detection.isTransaction,
                    mlCategory: detection.category,
                    mlConfidence: detection.confidence,
                    mlMerchant: detection.merchant,
                    needsReview: detection.needsReview || false,
                    parseEvidence: detection.mlRawResponse ? JSON.stringify(detection.mlRawResponse) : null,
                    scanJobId: `history-${Date.now()}`
                });

                processed++;
                if (detection.isTransaction) {
                    transactions++;
                }

                console.log(`[HistoryHandler] Processed message ${msg.id}: isTransaction=${detection.isTransaction}`);

            } catch (err) {
                console.error(`[HistoryHandler] Error processing message ${msg.id}:`, err);
            }
        }));

        await Promise.all(tasks);

        // 6. Update user's lastHistoryId
        if (history.historyId) {
            await pool.query(
                'UPDATE users SET gmail_history_id = $1, updated_at = NOW() WHERE id = $2',
                [history.historyId, userId]
            );
        }

        console.log(`[HistoryHandler] Completed: ${processed} processed, ${transactions} transactions`);

        return {
            processed,
            transactions,
            newHistoryId: history.historyId,
            requiresFullResync: false
        };

    } catch (error) {
        console.error('[HistoryHandler] Error:', error);
        throw error;
    }
}

/**
 * Get current history ID for a user
 */
export async function getCurrentHistoryId(userId: string): Promise<string | null> {
    const { rows } = await pool.query(
        'SELECT gmail_history_id FROM users WHERE id = $1',
        [userId]
    );

    return rows[0]?.gmail_history_id || null;
}
