/**
 * Email Reprocessing Service
 * Handles reprocessing of emails, manual card mapping, and pipeline stats
 * 
 * Extracted from GmailService as part of Issue #3 decomposition
 */

import pool, { query } from '@shared/database/db';
import { randomUUID } from 'crypto';
import logger from '@shared/utils/infrastructure/logger';
import * as gmailClient from '@shared/infra/google/gmailClient';
import * as cardsQueries from '@shared/database/queries/cards.queries';
import { SimplifiedEmail } from '@shared/types/transaction.types';
import { universalPipeline } from '@modules/transactions/services/pipeline/UniversalTransactionPipeline';
import { GmailConnectionService } from './gmail-connection.service';
import { HistoricalScanService } from './historical-scan.service';

export interface CardInfo {
    last4: string;
    bankName: string;
    cardType?: string;
}

export class EmailReprocessingService {
    /**
     * Reprocess a single email by message ID
     */
    static async reprocessEmail(userId: string, messageId: string) {
        logger.info('[EmailReprocessingService] Reprocessing email', { userId, messageId });

        const rawToken = await GmailConnectionService.getRefreshToken(userId);
        if (!rawToken) {
            throw new Error('Gmail not connected');
        }

        const message = await gmailClient.getMessage(rawToken, messageId);
        if (!message) {
            throw new Error('Message not found');
        }

        const jobId = randomUUID();
        const simpleEmail: SimplifiedEmail = {
            messageId: message.id,
            threadId: message.threadId,
            from: message.from,
            to: message.to,
            subject: message.subject,
            body: message.bodyText || message.snippet,
            internalDate: message.date.getTime(),
            snippet: message.snippet
        };

        const fetchAttachment = async (msgId: string, attId: string) =>
            gmailClient.getAttachment(rawToken, msgId, attId);

        const result = await universalPipeline.processEmail(userId, simpleEmail, jobId, fetchAttachment);

        return {
            messageId,
            result,
        };
    }

    /**
     * Manual map a message to a specific card
     */
    static async manualMapCard(userId: string, messageId: string, cardInfo: CardInfo) {
        console.log(`[EmailReprocessingService] Manual map for user ${userId}, message ${messageId}`, cardInfo);
        const jobId = randomUUID();

        // Create job record
        await query(
            `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, started_at, metadata)
             VALUES ($1, $2, 'PROCESSING', 'MANUAL_MAPPING', NOW(), $3)`,
            [jobId, userId, JSON.stringify({ messageId, cardInfo })]
        );

        // Run async
        (async () => {
            try {
                // 1. Ensure card exists
                let card = await cardsQueries.findCardByBankAndLastFour(userId, cardInfo.bankName, cardInfo.last4);
                if (!card) {
                    card = await cardsQueries.createCard({
                        userId,
                        bankName: cardInfo.bankName,
                        lastFour: cardInfo.last4,
                        cardName: `${cardInfo.bankName} ${cardInfo.last4}`,
                        billDate: 1,
                        dueDate: 10,
                        creditLimit: 0
                    });
                }

                // 2. Fetch message
                const rawToken = await GmailConnectionService.getRefreshToken(userId);
                if (!rawToken) throw new Error('Gmail not connected');

                const message = await gmailClient.getMessage(rawToken, messageId);
                if (!message) throw new Error('Message not found');

                // 3. Process via Universal Pipeline
                const simpleEmail: SimplifiedEmail = {
                    messageId: message.id,
                    threadId: message.threadId,
                    from: message.from,
                    to: message.to,
                    subject: message.subject,
                    body: message.bodyText || message.snippet,
                    internalDate: message.date.getTime(),
                    snippet: message.snippet
                };

                const fetchAttachment = async (msgId: string, attId: string) =>
                    gmailClient.getAttachment(rawToken, msgId, attId);

                const result = await universalPipeline.processEmail(userId, simpleEmail, jobId, fetchAttachment);

                if (result.status === 'success' || result.status === 'needs_review' || result.status === 'duplicate') {
                    const txnId = (result as any).transactionId;
                    if (txnId) {
                        // Force link to user-provided card
                        await query(
                            `UPDATE transactions SET card_id = $1, instrument_id = (
                                SELECT ui.id FROM instruments ui 
                                LEFT JOIN banks b ON ui.bank_id = b.id
                                WHERE ui.user_id = $2 AND b.name = $3 AND ui.type = 'credit_card' 
                                AND (ui.identifier LIKE $4 OR ui.last4 = RIGHT($4, 4)) LIMIT 1
                            ) WHERE id = $5`,
                            [card.id, userId, cardInfo.bankName, `%${cardInfo.last4}`, txnId]
                        );
                    }

                    await query(
                        `UPDATE gmail_sync_jobs 
                         SET status = 'COMPLETED', current_step = 'COMPLETED', processed_count = 1, saved_count = 1, completed_at = NOW()
                         WHERE id = $1`,
                        [jobId]
                    );
                } else {
                    throw new Error(`Pipeline processing failed: ${result.status} ${(result as any).reason || ''}`);
                }

            } catch (error) {
                logger.error('Manual map failed:', error);
                await query(
                    `UPDATE gmail_sync_jobs 
                     SET status = 'FAILED', errors = $1, completed_at = NOW()
                     WHERE id = $2`,
                    [JSON.stringify([{ error: error instanceof Error ? error.message : String(error) }]), jobId]
                );
            }
        })();

        return { jobId };
    }

    /**
     * Get pipeline statistics
     */
    static async getPipelineStats(userId: string) {
        const connection = await GmailConnectionService.getConnectionStatus(userId);
        const queueStats = { pending: 0 };
        const latestJob = await HistoricalScanService.getLatestJob(userId);
        const activeStatuses = ['PENDING', 'PROCESSING', 'FETCHING', 'GPT_PROCESSING'];
        const isJobRunning = latestJob && activeStatuses.includes(latestJob.status);

        return {
            connection,
            queues: queueStats,
            activeJob: isJobRunning ? {
                id: latestJob?.jobId,
                status: latestJob?.status,
                progress: latestJob?.processed ? `${latestJob.processed}/${latestJob.total}` : '0/0'
            } : null
        };
    }
}
