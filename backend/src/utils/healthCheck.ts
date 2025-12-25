import { query, getPoolStats } from '../lib/db';
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
    };
}

export const performHealthCheck = async (): Promise<HealthStatus> => {
    const start = Date.now();
    let dbStatus: 'up' | 'down' = 'up';
    let dbLatency: number | undefined;

    try {
        const dbStart = Date.now();
        await query('SELECT 1');
        dbLatency = Date.now() - dbStart;
    } catch (error) {
        dbStatus = 'down';
    }

    const status: 'healthy' | 'degraded' | 'unhealthy' = dbStatus === 'up' ? 'healthy' : 'degraded';

    return {
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            database: {
                status: dbStatus,
                latency: dbLatency
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
