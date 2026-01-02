import { query, getPoolStats } from '@shared/database/db';
import redis from '@shared/database/redis';
import os from 'os';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    services: {
        database: {
            status: 'up' | 'down';
            latency?: number;
        };
        redis: {
            status: 'up' | 'down';
            latency?: number;
        };
    };
}

export const performHealthCheck = async (): Promise<HealthStatus> => {
    const start = Date.now();
    let dbStatus: 'up' | 'down' = 'up';
    let dbLatency: number | undefined;
    let redisStatus: 'up' | 'down' = 'up';
    let redisLatency: number | undefined;

    try {
        const dbStart = Date.now();
        await query('SELECT 1');
        dbLatency = Date.now() - dbStart;
    } catch (error) {
        dbStatus = 'down';
    }

    try {
        const redisStart = Date.now();
        await redis.ping();
        redisLatency = Date.now() - redisStart;
    } catch (error) {
        redisStatus = 'down';
    }

    const status: 'healthy' | 'degraded' | 'unhealthy' =
        (dbStatus === 'up' && redisStatus === 'up') ? 'healthy' :
            (dbStatus === 'up' || redisStatus === 'up') ? 'degraded' : 'unhealthy';

    return {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: {
                status: dbStatus,
                latency: dbLatency
            },
            redis: {
                status: redisStatus,
                latency: redisLatency
            }
        }
    };
};

export const getSystemMetrics = () => {
    return {
        memory: process.memoryUsage(),
        cpu: os.cpus().length,
        loadAvg: os.loadavg(),
        uptime: os.uptime(),
        hostname: os.hostname()
    };
};

export const getDatabaseStats = async () => {
    const stats = getPoolStats();
    // We can add more detailed DB stats here if needed, like specific table counts
    // For now, pool stats are good.
    return {
        pool: stats
    };
};
