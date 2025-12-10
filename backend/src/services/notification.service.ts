import { Response } from 'express';

// NOTE: configurable heartbeat interval for frontend notifications
// Change FRONTEND_NOTIFICATION_INTERVAL_MS to adjust frequency (default: 30s)
export const FRONTEND_NOTIFICATION_INTERVAL_MS = 30000;

/**
 * Notification Service (SSE)
 * Maintains connections to frontend clients and pushes updates.
 */
export class NotificationService {
    private static clients: { id: number; res: Response }[] = [];
    private static nextClientId = 1;
    private static heartbeatInterval: NodeJS.Timeout | null = null;

    // External state provider for heartbeat
    private static statsProvider: (() => Promise<any> | any) | null = null;

    /**
     * Subscribe a client to the stream
     */
    static subscribe(res: Response) {
        // Headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const clientId = this.nextClientId++;
        this.clients.push({ id: clientId, res });

        console.log(`[NotificationService] Client ${clientId} connected. Total: ${this.clients.length}`);

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

        // Force an immediate heartbeat if running
        if (this.heartbeatInterval && this.statsProvider) {
            Promise.resolve(this.statsProvider()).then(stats => {
                const payload = {
                    type: "sync-status",
                    timestamp: new Date().toISOString(),
                    ...stats
                };
                res.write(`data: ${JSON.stringify({ type: 'sync-status', payload })}\n\n`);
            }).catch(() => { });
        }

        // Cleanup on close
        res.on('close', () => {
            console.log(`[NotificationService] Client ${clientId} disconnected`);
            this.clients = this.clients.filter(c => c.id !== clientId);
        });
    }

    /**
     * Broadcast a message to all connected clients
     */
    static broadcast(type: string, payload: any) {
        if (this.clients.length === 0) return;

        const data = JSON.stringify({ type, payload });
        const message = `data: ${data}\n\n`;

        this.clients.forEach(client => {
            client.res.write(message);
        });
    }

    /**
     * Notify about a new transaction
     */
    static notifyNewTransaction(transaction: any) {
        this.broadcast('NEW_TRANSACTION', transaction);
    }

    /**
     * Start the heartbeat loop
     */
    static startHeartbeat(provider: () => Promise<any> | any) {
        if (this.heartbeatInterval) return; // Already running

        this.statsProvider = provider;
        console.log(`[NotificationService] Starting heartbeat (Interval: ${FRONTEND_NOTIFICATION_INTERVAL_MS}ms)`);

        this.heartbeatInterval = setInterval(async () => {
            if (this.statsProvider) {
                try {
                    const stats = await this.statsProvider();
                    const status = {
                        type: "sync-status",
                        timestamp: new Date().toISOString(),
                        ...stats
                    };
                    this.broadcast('sync-status', status);
                    console.log(`[Sync] Sent status update: `, status);
                } catch (e) {
                    console.error('[NotificationService] Heartbeat provider failed:', e);
                }
            }
        }, FRONTEND_NOTIFICATION_INTERVAL_MS);
    }

    /**
     * Stop the heartbeat loop
     */
    static stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            this.statsProvider = null;
            console.log('[NotificationService] Stopped heartbeat');
        }
    }
}
