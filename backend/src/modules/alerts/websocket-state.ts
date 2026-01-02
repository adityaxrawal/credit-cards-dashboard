import { Server as SocketIOServer } from 'socket.io';
import logger from '@shared/utils/infrastructure/logger';

export interface ScanJob {
    jobId: string;
    userId: string;
    totalEmails: number;
    totalProcessed: number;
    totalTransactions: number;
    totalErrors: number;
    queueStatus: {
        queue1: number;  // Processing queue
        queue2: number;  // DB write queue / worker pool queue

    };
    status?: string;
    currentStep?: string;
    postProcessingStats?: {
        billsCreated?: number;
        instrumentsCreated?: number;
    };

    // NEW: Rate metrics
    fetchRate?: number;      // emails/sec
    processRate?: number;    // emails/sec
    dbFlushRate?: number;    // batches/sec

    // NEW: Detailed queue depths
    queueDepths?: {
        processing: number;
        dbScannedEmails: number;
        dbTransactions: number;
        dbTerminations: number;

    };



    // NEW: Error breakdown
    errorBreakdown?: {
        gmail429s: number;
        dbRetries: number;
        skippedEmails: number;
        processingErrors: number;
    };
}

export const activeJobs = new Map<string, ScanJob>();

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
        queueStatus: { queue1: 0, queue2: 0 }
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

    // Reduce log noise, only log status changes or major progress
    // logger.debug(`Broadcast update for job ${jobId}`, job);
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
