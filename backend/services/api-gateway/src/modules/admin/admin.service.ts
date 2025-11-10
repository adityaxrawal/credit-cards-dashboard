/**
 * Admin Service
 * Provides system health metrics and monitoring data
 */

import { supabase } from "shared/database/supabase";
import redis from "shared/cache/redis";
import { getGlobalCacheMetrics } from "shared/cache/cache-metrics";
import { logger } from "shared/monitoring/logger";

interface SystemMetrics {
  uptime: {
    seconds: number;
    formatted: string;
  };
  cache: {
    status: "healthy" | "degraded" | "unavailable";
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    connectionStatus: string;
  };
  database: {
    status: "healthy" | "degraded" | "unavailable";
    latency: number;
    connectionCount?: number;
  };
  api: {
    averageLatency: number;
    requestCount: number;
    errorRate: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  timestamp: string;
}

let requestCount = 0;
let errorCount = 0;
const startTime = Date.now();

/**
 * Increment request counter
 */
export function incrementRequestCount(): void {
  requestCount++;
}

/**
 * Increment error counter
 */
export function incrementErrorCount(): void {
  errorCount++;
}

/**
 * Get system health metrics
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const uptimeFormatted = formatUptime(uptime);

  // Get cache metrics
  const cacheMetrics = getGlobalCacheMetrics();
  const cacheStatus = await checkCacheHealth();
  const totalRequests = cacheMetrics.totalHits + cacheMetrics.totalMisses;
  const hitRate = totalRequests > 0 ? (cacheMetrics.totalHits / totalRequests) * 100 : 0;

  // Get database metrics
  const dbMetrics = await checkDatabaseHealth();

  // Calculate API metrics
  const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

  // Get memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercentage = (memoryUsedMB / memoryTotalMB) * 100;

  return {
    uptime: {
      seconds: uptime,
      formatted: uptimeFormatted,
    },
    cache: {
      status: cacheStatus,
      hitRate: Math.round(hitRate * 100) / 100,
      totalHits: cacheMetrics.totalHits,
      totalMisses: cacheMetrics.totalMisses,
      connectionStatus: cacheStatus === "healthy" ? "connected" : "disconnected",
    },
    database: {
      status: dbMetrics.status,
      latency: dbMetrics.latency,
      connectionCount: dbMetrics.connectionCount,
    },
    api: {
      averageLatency: 0, // TODO: Implement latency tracking
      requestCount,
      errorRate: Math.round(errorRate * 100) / 100,
    },
    memory: {
      used: memoryUsedMB,
      total: memoryTotalMB,
      percentage: Math.round(memoryPercentage * 100) / 100,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check cache health
 */
async function checkCacheHealth(): Promise<"healthy" | "degraded" | "unavailable"> {
  try {
    const testKey = "health-check-" + Date.now();
    await redis.set(testKey, "1", 5);
    const value = await redis.get(testKey);
    await redis.del(testKey);

    if (value === "1") {
      return "healthy";
    }
    return "degraded";
  } catch (error) {
    logger.error("Cache health check failed:", error);
    return "unavailable";
  }
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "degraded" | "unavailable";
  latency: number;
  connectionCount?: number;
}> {
  try {
    const dbStartTime = Date.now();
    const { error } = await supabase.from("users").select("id").limit(1);

    const latency = Date.now() - dbStartTime;

    if (error) {
      logger.error("Database health check failed:", error);
      return {
        status: "unavailable",
        latency,
      };
    }

    // Healthy if latency < 100ms, degraded if < 500ms
    const status = latency < 100 ? "healthy" : latency < 500 ? "degraded" : "unavailable";

    return {
      status,
      latency,
    };
  } catch (error) {
    logger.error("Database health check error:", error);
    return {
      status: "unavailable",
      latency: -1,
    };
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}
