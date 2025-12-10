import pool from '../lib/db';
import redis from '../lib/redis';
import { Server } from 'http';

export class GracefulShutdown {
    private isShuttingDown = false;
    private activeJobs = new Set<string>();

    registerJob(jobId: string): void {
        if (this.isShuttingDown) {
            console.warn(`[Shutdown] Attempted to register job ${jobId} during shutdown. Rejection recommended.`);
            // Depend on caller to handle rejection
        }
        this.activeJobs.add(jobId);
    }

    unregisterJob(jobId: string): void {
        this.activeJobs.delete(jobId);
    }

    async shutdown(signal: string, server: Server): Promise<void> {
        if (this.isShuttingDown) return;

        console.log(`[Shutdown] Received ${signal}, starting graceful shutdown...`);
        this.isShuttingDown = true;

        // 1. Stop accepting new HTTP requests
        server.close(() => {
            console.log('[Shutdown] HTTP server closed');
        });

        // 2. Wait for active jobs (max 30s)
        if (this.activeJobs.size > 0) {
            console.log(`[Shutdown] Waiting for ${this.activeJobs.size} active jobs to complete...`);
            const maxWait = 30000;
            const start = Date.now();

            while (this.activeJobs.size > 0 && (Date.now() - start < maxWait)) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (this.activeJobs.size > 0) {
                console.warn(`[Shutdown] Timeout reached. Forcing exit with ${this.activeJobs.size} jobs remaining.`);
            } else {
                console.log('[Shutdown] All jobs completed.');
            }
        } else {
            console.log('[Shutdown] No active jobs.');
        }

        // 3. Close database connections
        try {
            await pool.end();
            console.log('[Shutdown] Postgres pool closed');
        } catch (e) {
            console.error('[Shutdown] Error closing Postgres pool:', e);
        }

        // 4. Close Redis connection if applicable 
        // Upstash HTTP client is stateless but if we wrapped it or used TCP we'd close it.
        // The redis.ts exports a default Redis client which doesn't really have a 'quit' for HTTP, 
        // but looking at `redis.ts` import { Redis } from '@upstash/redis', it doesn't need explicit close.
        // However, the report recommended `await redis.quit()`. 
        // If using @upstash/redis with HTTP, quit isn't necessary/available.
        // I check the file `backend/src/lib/redis.ts` previously shown.
        // It imports from `@upstash/redis`. 
        // I will skip redis.quit() as it's likely HTTP based, or wrap in try-catch if methods exist.

        console.log('[Shutdown] Graceful shutdown complete');
        process.exit(0);
    }
}

export const shutdownHandler = new GracefulShutdown();
