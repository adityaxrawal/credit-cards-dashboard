import { Request, Response } from 'express';
import * as gmailService from '../services/gmail.service';
import { processHistoryChanges, getCurrentHistoryId } from '../jobs/gmailHistoryHandler';
import pool from '../lib/db';
import * as gmailClient from '../lib/gmailClient';
import { CreditCardMailDetector } from '../services/CreditCardMailDetector';

/**
 * Trigger historical sync
 * POST /api/sync/historical
 */
export async function triggerHistoricalSync(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { fromDate, toDate } = req.body;

        console.log(`[SyncController] Starting historical sync for user ${userId}`);

        const result = await gmailService.triggerHistoricalScan(
            userId,
            fromDate ? new Date(fromDate) : undefined,
            toDate ? new Date(toDate) : undefined
        );

        res.json({
            success: true,
            jobId: result.jobId,
            status: result.status,
            message: 'Historical sync started. Poll /api/sync/status/:jobId for progress.'
        });
    } catch (error) {
        console.error('[SyncController] Historical sync error:', error);
        res.status(500).json({
            error: 'Failed to start historical sync',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get sync job status
 * GET /api/sync/status/:jobId
 */
export async function getSyncStatus(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { jobId } = req.params;

        const status = await gmailService.getHistoricalScanStatus(userId, jobId);

        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('[SyncController] Status check error:', error);
        res.status(500).json({
            error: 'Failed to get sync status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Trigger incremental sync
 * POST /api/sync/incremental
 */
export async function triggerIncrementalSync(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`[SyncController] Starting incremental sync for user ${userId}`);

        // Get current history ID
        const lastHistoryId = await getCurrentHistoryId(userId);

        if (!lastHistoryId) {
            return res.status(400).json({
                error: 'No history ID found',
                message: 'Please run a historical sync first to establish baseline'
            });
        }

        const result = await processHistoryChanges(userId, lastHistoryId);

        if (result.requiresFullResync) {
            return res.json({
                success: false,
                requiresFullResync: true,
                message: 'History gap detected. Please run a full historical sync.'
            });
        }

        res.json({
            success: true,
            processed: result.processed,
            transactions: result.transactions,
            newHistoryId: result.newHistoryId
        });
    } catch (error) {
        console.error('[SyncController] Incremental sync error:', error);
        res.status(500).json({
            error: 'Failed to run incremental sync',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Run reconciliation check
 * GET /api/sync/debug/reconcile
 */
/**
 * Run reconciliation check
 * GET /api/sync/debug/reconcile
 * 
 * OPTIMIZED: Uses streaming/batching to prevent OOM on large mailboxes
 */
export async function runReconciliation(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`[SyncController] Running reconciliation for user ${userId}`);

        // 1. Get user's refresh token
        const { rows: users } = await pool.query(
            'SELECT google_refresh_token FROM users WHERE id = $1',
            [userId]
        );

        if (users.length === 0 || !users[0].google_refresh_token) {
            return res.status(400).json({
                error: 'Gmail not connected',
                message: 'Please connect your Gmail account first'
            });
        }

        const refreshToken = users[0].google_refresh_token;

        // 2. Build query for bank senders
        const senderFilter = CreditCardMailDetector.SENDER_DOMAINS
            .map(domain => `from:"${domain}"`)
            .join(' OR ');
        // We sync from roughly start of fiscal year or fixed date
        const query = `after:2023/09/30 (${senderFilter})`;

        console.log('[SyncController] Starting efficient reconciliation...');

        const missingInDb: string[] = [];
        let gmailCount = 0;
        let dbCount = 0; // We will count checked ones

        // 3. Stream/Batch Fetch from Gmail and Check DB immediately
        // Instead of listAllMessages (which buffers all), we loop manually
        let pageToken: string | undefined = undefined;
        let hasMore = true;
        const BATCH_SIZE = 500;

        // We also want to know total DB count for stats
        const dbCountResult = await pool.query('SELECT COUNT(*) FROM gmail_scanned_emails WHERE user_id = $1', [userId]);
        const totalInDb = parseInt(dbCountResult.rows[0].count);

        while (hasMore) {
            const response = await gmailClient.listMessages(refreshToken, query, BATCH_SIZE, pageToken);
            const messages = response.messages;
            pageToken = response.nextPageToken;

            if (!messages || messages.length === 0) {
                if (!pageToken) hasMore = false;
                continue;
            }

            gmailCount += messages.length;
            const batchIds = messages.map(m => m.id);

            // Check this batch against DB
            // We use the same query pattern as getProcessedMessageIds but we want to find MISSING ones
            const { rows: existingRows } = await pool.query(
                `SELECT message_id FROM gmail_scanned_emails WHERE user_id = $1 AND message_id = ANY($2)`,
                [userId, batchIds]
            );

            const existingSet = new Set(existingRows.map(r => r.message_id));

            for (const id of batchIds) {
                if (!existingSet.has(id)) {
                    missingInDb.push(id);
                }
            }

            if (!pageToken) hasMore = false;

            // Safety break to prevent infinite loops if something weird happens
            if (gmailCount > 100000) {
                console.warn('[SyncController] Reconciliation hit safe limit of 100k messages');
                break;
            }
        }

        // Note: Detecting "Extra in DB" (deleted from Gmail) is expensive (requires full DB scan vs Gmail set).
        // We skip it for performance as critical issue is usually Missing emails.
        const extraInDb = 0;
        const extraIds: string[] = [];

        const result = {
            success: true,
            gmailCount,
            dbCount: totalInDb,
            missingInDb: missingInDb.length,
            extraInDb: 'Not Checked (Optimization)',
            isSynced: missingInDb.length === 0,
            missingIds: missingInDb.slice(0, 50), // First 50
            extraIds: []
        };

        console.log(`[SyncController] Reconciliation complete: ${result.missingInDb} missing`);

        res.json(result);
    } catch (error) {
        console.error('[SyncController] Reconciliation error:', error);
        res.status(500).json({
            error: 'Failed to run reconciliation',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get latest sync job
 * GET /api/sync/latest
 */
export async function getLatestJob(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const job = await gmailService.getLatestJob(userId);

        if (!job) {
            return res.json({
                success: true,
                hasJob: false
            });
        }

        res.json({
            success: true,
            hasJob: true,
            ...job
        });
    } catch (error) {
        console.error('[SyncController] Latest job error:', error);
        res.status(500).json({
            error: 'Failed to get latest job',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get ML statistics
 * GET /api/sync/stats
 */
export async function getMLStats(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { rows } = await pool.query(
            `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ml_is_transaction = true OR is_transaction = true) as transactions,
        COUNT(*) FILTER (WHERE needs_review = true) as needs_review,
        AVG(COALESCE(ml_confidence, detection_confidence, 0)) as avg_confidence,
        COUNT(*) FILTER (WHERE COALESCE(ml_confidence, detection_confidence, 0) < 0.5) as low_confidence,
        COUNT(*) FILTER (WHERE COALESCE(ml_confidence, detection_confidence, 0) >= 0.7) as high_confidence
       FROM gmail_scanned_emails 
       WHERE user_id = $1`,
            [userId]
        );

        const stats = rows[0];

        res.json({
            success: true,
            total: parseInt(stats.total || '0'),
            transactions: parseInt(stats.transactions || '0'),
            needsReview: parseInt(stats.needs_review || '0'),
            avgConfidence: parseFloat(stats.avg_confidence || '0').toFixed(3),
            lowConfidence: parseInt(stats.low_confidence || '0'),
            highConfidence: parseInt(stats.high_confidence || '0')
        });
    } catch (error) {
        console.error('[SyncController] Stats error:', error);
        res.status(500).json({
            error: 'Failed to get ML stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
