/**
 * Health Check Service
 * Phase 6: Post-Launch & Optimization
 */

import { createClient } from 'redis';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    api: ServiceHealth;
  };
  uptime: number;
  version: string;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  message?: string;
}

const startTime = Date.now();

/**
 * Check database health
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    const supabase = createSupabaseClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { error } = await supabase.from('users').select('count').limit(1);
    
    const latency = Date.now() - start;

    if (error) {
      return {
        status: 'down',
        latency,
        message: error.message,
      };
    }

    return {
      status: latency < 100 ? 'up' : 'degraded',
      latency,
    };
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error.message,
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now();
  
  try {
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    await redis.connect();
    await redis.ping();
    await redis.quit();

    const latency = Date.now() - start;

    return {
      status: latency < 50 ? 'up' : 'degraded',
      latency,
    };
  } catch (error: any) {
    return {
      status: 'down',
      latency: Date.now() - start,
      message: error.message,
    };
  }
}

/**
 * Check API health (basic check)
 */
function checkAPI(): ServiceHealth {
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  if (heapUsedPercent > 90) {
    return {
      status: 'degraded',
      message: `High memory usage: ${heapUsedPercent.toFixed(2)}%`,
    };
  }

  return {
    status: 'up',
  };
}

/**
 * Perform comprehensive health check
 */
export async function healthCheck(): Promise<HealthStatus> {
  const [database, redis] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);

  const api = checkAPI();

  const services = { database, redis, api };

  // Determine overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (Object.values(services).some((s) => s.status === 'down')) {
    status = 'unhealthy';
  } else if (Object.values(services).some((s) => s.status === 'degraded')) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: Date.now(),
    services,
    uptime: Date.now() - startTime,
    version: process.env.APP_VERSION || '1.0.0',
  };
}
