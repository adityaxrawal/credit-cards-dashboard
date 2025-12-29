import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import logger from '../../utils/infrastructure/logger';
import { activeJobs } from './WebSocketState';

export function initializeWebSocket(httpServer: Server) {
    const io = new SocketIOServer(httpServer, {
        cors: { origin: '*' },
        pingInterval: 25000,    // Send ping every 25 seconds
        pingTimeout: 60000,     // Wait 60 seconds for pong response (increased from 20s)
        transports: ['websocket', 'polling'], // Allow polling fallback for better reliability
    });

    // Share io instance globally for the broadcast functions in WebSocketState
    (global as any).ioServer = io;

    io.on('connection', (socket) => {
        logger.info(`Client connected: ${socket.id}`);
        console.log(`[WS] Client connected: ${socket.id}`);

        // Heartbeat handler for client-initiated keepalive
        socket.on('heartbeat', (data: { timestamp?: number }) => {
            socket.emit('heartbeat_ack', {
                timestamp: Date.now(),
                clientTimestamp: data?.timestamp
            });
        });

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
                            totalErrors: job.totalErrors, // Ensure errors are sent
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

        socket.on('disconnect', (reason) => {
            logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
            console.log(`[WS] Client disconnected: ${socket.id}, reason: ${reason}`);
        });
    });

    return io;
}

// Re-export for backward compatibility if needed, but preferably use WebSocketState
export { broadcastProcessingUpdate, broadcastJobComplete, sendUserAlert } from './WebSocketState';
