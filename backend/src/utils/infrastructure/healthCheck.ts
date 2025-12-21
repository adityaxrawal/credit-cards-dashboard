/**
 * System Health Monitoring Utilities
 * Provides health checks, metrics collection, and system status monitoring
 */

import pool from '../../lib/db';
import redis from '../../lib/redis';
import logger from './logger';

export interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    checks: {
        database: ComponentHealth;
        redis: ComponentHealth;
        memory: ComponentHealth;
    };
}

export interface ComponentHealth {
    status: 'up' | 'down' | 'degraded';
    latency?: number;
    message?: string;
    details?: any;
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    const [dbHealth, redisHealth, memHealth] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkMemory()
    ]);

    const allHealthy = dbHealth.status === 'up' && redisHealth.status === 'up' && memHealth.status === 'up';
    const anyDown = dbHealth.status === 'down' || redisHealth.status === 'down';

    return {
        status: anyDown ? 'unhealthy' : (allHealthy ? 'healthy' : 'degraded'),
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
            database: dbHealth,
            redis: redisHealth,
            memory: memHealth
        }
    };
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
        await pool.query('SELECT 1');
        const latency = Date.now() - startTime;

        return {
            status: latency < 100 ? 'up' : 'degraded',
            latency,
            message: latency < 100 ? 'Database responsive' : 'Database slow'
        };
    } catch (error: any) {
        logger.error('database_health_check_failed', { error: error.message });
        return {
            status: 'down',
            message: 'Database connection failed',
            details: error.message
        };
    }
}

/**
 * Check Redis connectivity
 */
async function checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
        if (!redis) {
            return {
                status: 'degraded',
                message: 'Redis not initialized (running without cache)'
            };
        }

        await redis.ping();
        const latency = Date.now() - startTime;

        return {
            status: latency < 50 ? 'up' : 'degraded',
            latency,
            message: 'Redis responsive'
        };
    } catch (error: any) {
        logger.error('redis_health_check_failed', { error: error.message });
        return {
            status: 'down',
            message: 'Redis connection failed',
            details: error.message
        };
    }
}

/**
 * Check memory usage
 */
function checkMemory(): ComponentHealth {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const percentUsed = (usage.heapUsed / usage.heapTotal) * 100;

    return {
        status: percentUsed < 80 ? 'up' : (percentUsed < 90 ? 'degraded' : 'down'),
        message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${percentUsed.toFixed(1)}%)`,
        details: {
            heapUsed: heapUsedMB,
            heapTotal: heapTotalMB,
            percentUsed: percentUsed.toFixed(1),
            rss: Math.round(usage.rss / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024)
        }
    };
}

/**
 * Get database connection pool stats
 */
export async function getDatabaseStats() {
    try {
        return {
            totalConnections: pool.totalCount,
            idleConnections: pool.idleCount,
            waitingRequests: pool.waitingCount
        };
    } catch (error) {
        logger.error('get_database_stats_failed', { error });
        return null;
    }
}

/**
 * Get system metrics
 */
export function getSystemMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
        uptime: process.uptime(),
        memory: {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024)
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
        },
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
    };
}
