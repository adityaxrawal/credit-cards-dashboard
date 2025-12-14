import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import logger from '../utils/logger';

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
}

const activeJobs = new Map<string, ScanJob>();

export function initializeWebSocket(httpServer: Server) {
    const io = new SocketIOServer(httpServer, {
        cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
        logger.info(`Client connected: ${socket.id}`);

        socket.on('subscribe', (data) => {
            const { jobId } = data;
            socket.join(`job-${jobId}`);
            logger.info(`Client ${socket.id} subscribed to job ${jobId}`);

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
                    },
                });
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
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
        },
    });

    logger.debug(`Broadcast update for job ${jobId}`, job);
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
