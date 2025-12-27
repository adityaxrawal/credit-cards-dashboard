import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import logger from '../../utils/infrastructure/logger';

interface ScanJob {
    jobId: string;
    userId: string;
    totalEmails: number;
    totalProcessed: number;
    totalTransactions: number;
    totalErrors: number;
    queueStatus: {
        queue1: number;
        queue2: number;
        queue3: number;
    };
    status?: string;
    currentStep?: string;
    postProcessingStats?: {
        billsCreated?: number;
        instrumentsCreated?: number;
    };
}

const activeJobs = new Map<string, ScanJob>();

export function initializeWebSocket(httpServer: Server) {
    const io = new SocketIOServer(httpServer, {
        cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
        logger.info(`Client connected: ${socket.id}`);
        console.log(`[WS] Client connected: ${socket.id}`);

        socket.on('subscribe', async (data) => {
            const { jobId, userId } = data;

            if (jobId) {
                socket.join(`job-${jobId}`);
                logger.info(`Client ${socket.id} subscribed to job ${jobId}`);
                console.log(`[WS] Client ${socket.id} joined job-${jobId}`);

                // Send current status immediately
                const job = activeJobs.get(jobId);
                if (job) {
                    socket.emit('processing_update', {
                        type: 'processing_update',
                        payload: {
                            totalProcessed: job.totalProcessed,
                            totalEmails: job.totalEmails,
                            totalTransactions: job.totalTransactions,
                            totalErrors: job.totalErrors,
                            queueStatus: job.queueStatus,
                            status: job.status,
                            currentStep: job.currentStep,
                            postProcessingStats: job.postProcessingStats,
                        },
                    });
                }
            }

            if (userId) {
                // Validate user exists before accepting subscription
                try {
                    const { safeQuery } = await import('../../lib/db');
                    const result = await safeQuery('SELECT id FROM users WHERE id = $1', [userId]);
                    if (result.rows.length === 0) {
                        console.log(`[WS] Rejected subscription: user ${userId} not found`);
                        socket.emit('error', { code: 'USER_NOT_FOUND', message: 'Invalid user' });
                        return;
                    }
                    socket.join(`user-${userId}`);
                    logger.info(`Client ${socket.id} subscribed to user ${userId}`);
                } catch (err) {
                    logger.error('[WS] User validation failed:', err);
                    socket.emit('error', { code: 'VALIDATION_ERROR', message: 'Subscription failed' });
                    return;
                }
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
}

/**
 * Send alert to specific user
 */
export function sendUserAlert(userId: string, alert: any) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const io = (global as any).ioServer;
    if (!io) return;

    io.to(`user-${userId}`).emit('new_alert', {
        type: 'new_alert',
        payload: alert
    });
}

/**
 * Broadcast processing update to all clients watching this job
 */
export function broadcastProcessingUpdate(
    jobId: string,
    update: Partial<ScanJob>
) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const io = (global as any).ioServer;
    if (!io) return;

    const defaultJob: ScanJob = {
        jobId,
        userId: '',
        totalEmails: 0,
        totalProcessed: 0,
        totalTransactions: 0,
        totalErrors: 0,
        queueStatus: { queue1: 0, queue2: 0, queue3: 0 }
    };

    const job = activeJobs.get(jobId) || defaultJob;
    Object.assign(job, update);
    activeJobs.set(jobId, job as ScanJob);

    io.to(`job-${jobId}`).emit('processing_update', {
        type: 'processing_update',
        payload: {
            totalProcessed: job.totalProcessed,
            totalEmails: job.totalEmails,
            totalTransactions: job.totalTransactions,
            totalErrors: job.totalErrors,
            queueStatus: job.queueStatus,
            status: job.status,
            currentStep: job.currentStep,
            postProcessingStats: job.postProcessingStats,
        },
    });

    logger.debug(`Broadcast update for job ${jobId}`, job);
    console.log(`[WS-BROADCAST] Job ${jobId} -> Step: ${job.currentStep || 'Unknown'} | Processed: ${job.totalProcessed}/${job.totalEmails}`);
}

/**
 * Notify job completion
 */
export function broadcastJobComplete(jobId: string, finalStats: any) {
    const io = (global as any).ioServer;
    if (!io) return;

    io.to(`job-${jobId}`).emit('processing_complete', {
        type: 'processing_complete',
        payload: finalStats,
    });

    activeJobs.delete(jobId);
}
