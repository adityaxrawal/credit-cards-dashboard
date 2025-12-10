import pool from '../lib/db';
import redis from '../lib/redis';
import { OllamaService } from '../services/ollama.service';
import * as gmailClient from '../lib/gmailClient';

export interface HealthStatus {
    postgres: PromiseSettledResult<void>;
    redis: PromiseSettledResult<string>; // ping returns string 'PONG' or 'OK'
    ollama: PromiseSettledResult<boolean>;
    gmail: PromiseSettledResult<void>;
    status: 'healthy' | 'degraded' | 'unhealthy';
}

export class HealthChecker {
    async checkAll(): Promise<HealthStatus> {
        const checks = await Promise.allSettled([
            this.checkPostgres(),
            this.checkRedis(),
            this.checkOllama(),
            this.checkGmailAPI(),
        ]);

        const results: any = {
            postgres: checks[0],
            redis: checks[1],
            ollama: checks[2],
            gmail: checks[3],
        };

        results.status = checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded';

        // If Postgres is down, it's unhealthy (critical)
        if (results.postgres.status === 'rejected') {
            results.status = 'unhealthy';
        }

        return results as HealthStatus;
    }

    async checkPostgres(): Promise<void> {
        await pool.query('SELECT 1');
    }

    async checkRedis(): Promise<string> {
        return await redis.ping();
    }

    async checkOllama(): Promise<boolean> {
        // Basic connectivity check, not model validation to save time on startup
        // But OllamaService.healthCheck() does more. Let's use it.
        const healthy = await OllamaService.healthCheck();
        if (!healthy) throw new Error('Ollama unavailable');
        return true;
    }

    async checkGmailAPI(): Promise<void> {
        // Use service account or test token env var
        // If not provided, skip or mark as skipped (resolve)
        // For now, we only check if env vars are present as a proxy, 
        // or use a specific health check token if configured.
        const testToken = process.env.GMAIL_HEALTH_CHECK_TOKEN;
        if (testToken) {
            const healthy = await gmailClient.checkHealth(testToken);
            if (!healthy) throw new Error('Gmail API health check failed');
        } else {
            // Without a token, we can't really call the API. 
            // We assume it's 'ok' if configuration exists, or maybe we shouldn't block server start on Gmail.
            if (!process.env.GOOGLE_CLIENT_ID) throw new Error('Missing Google Client ID');
        }
    }
}
