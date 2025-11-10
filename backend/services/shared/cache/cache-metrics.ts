/**
 * Cache Metrics Tracker - Lightweight in-memory metrics for cache operations
 *
 * Tracks cache hit/miss ratios and errors without requiring external monitoring services.
 * Metrics are stored in memory and can be flushed to logs periodically.
 */

import { logger } from "../monitoring/logger";

/**
 * Metrics storage structure
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  lastReset: Date;
}

/**
 * Module-specific metrics
 */
interface ModuleMetrics {
  [module: string]: {
    [userId: string]: {
      [resource: string]: CacheMetrics;
    };
  };
}

// In-memory metrics storage
const metrics: ModuleMetrics = {};

/**
 * Initialize metrics for a specific key
 */
function initializeMetrics(module: string, userId: string, resource: string): void {
  if (!metrics[module]) {
    metrics[module] = {};
  }
  if (!metrics[module][userId]) {
    metrics[module][userId] = {};
  }
  if (!metrics[module][userId][resource]) {
    metrics[module][userId][resource] = {
      hits: 0,
      misses: 0,
      errors: 0,
      lastReset: new Date(),
    };
  }
}

/**
 * Increment cache hit counter
 * @param module - Module name
 * @param userId - User ID
 * @param resource - Resource identifier
 */
export function incrementCacheHit(module: string, userId: string, resource: string): void {
  initializeMetrics(module, userId, resource);
  metrics[module][userId][resource].hits++;
}

/**
 * Increment cache miss counter
 * @param module - Module name
 * @param userId - User ID
 * @param resource - Resource identifier
 */
export function incrementCacheMiss(module: string, userId: string, resource: string): void {
  initializeMetrics(module, userId, resource);
  metrics[module][userId][resource].misses++;
}

/**
 * Record a cache error
 * @param module - Module name
 * @param userId - User ID
 * @param resource - Resource identifier
 * @param error - Error object or message
 */
export function recordCacheError(
  module: string,
  userId: string,
  resource: string,
  error: Error | string
): void {
  initializeMetrics(module, userId, resource);
  metrics[module][userId][resource].errors++;

  const errorObj = error instanceof Error ? error : new Error(String(error));
  logger.error("Cache error recorded", errorObj, {
    cacheModule: module,
    userId,
    resource,
  });
}

/**
 * Get metrics for a specific user and module
 * @param module - Module name
 * @param userId - User ID
 * @returns Aggregated metrics for the user in the module
 */
export function getCacheMetricsForUser(
  module: string,
  userId: string
): {
  totalHits: number;
  totalMisses: number;
  totalErrors: number;
  hitRate: number;
  resources: Record<string, CacheMetrics>;
} {
  if (!metrics[module] || !metrics[module][userId]) {
    return {
      totalHits: 0,
      totalMisses: 0,
      totalErrors: 0,
      hitRate: 0,
      resources: {},
    };
  }

  const userMetrics = metrics[module][userId];
  let totalHits = 0;
  let totalMisses = 0;
  let totalErrors = 0;

  Object.values(userMetrics).forEach((resourceMetrics) => {
    totalHits += resourceMetrics.hits;
    totalMisses += resourceMetrics.misses;
    totalErrors += resourceMetrics.errors;
  });

  const totalRequests = totalHits + totalMisses;
  const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

  return {
    totalHits,
    totalMisses,
    totalErrors,
    hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    resources: userMetrics,
  };
}

/**
 * Get all metrics for a module
 * @param module - Module name
 * @returns All metrics for the module
 */
export function getCacheMetricsForModule(module: string): {
  totalHits: number;
  totalMisses: number;
  totalErrors: number;
  hitRate: number;
  userCount: number;
} {
  if (!metrics[module]) {
    return {
      totalHits: 0,
      totalMisses: 0,
      totalErrors: 0,
      hitRate: 0,
      userCount: 0,
    };
  }

  let totalHits = 0;
  let totalMisses = 0;
  let totalErrors = 0;

  Object.values(metrics[module]).forEach((userMetrics) => {
    Object.values(userMetrics).forEach((resourceMetrics) => {
      totalHits += resourceMetrics.hits;
      totalMisses += resourceMetrics.misses;
      totalErrors += resourceMetrics.errors;
    });
  });

  const totalRequests = totalHits + totalMisses;
  const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

  return {
    totalHits,
    totalMisses,
    totalErrors,
    hitRate: Math.round(hitRate * 100) / 100,
    userCount: Object.keys(metrics[module]).length,
  };
}

/**
 * Get global cache metrics across all modules
 */
export function getGlobalCacheMetrics(): {
  totalHits: number;
  totalMisses: number;
  totalErrors: number;
  hitRate: number;
  moduleCount: number;
  modules: Record<string, ReturnType<typeof getCacheMetricsForModule>>;
} {
  let totalHits = 0;
  let totalMisses = 0;
  let totalErrors = 0;
  const moduleMetrics: Record<string, ReturnType<typeof getCacheMetricsForModule>> = {};

  Object.keys(metrics).forEach((module) => {
    const moduleStats = getCacheMetricsForModule(module);
    moduleMetrics[module] = moduleStats;
    totalHits += moduleStats.totalHits;
    totalMisses += moduleStats.totalMisses;
    totalErrors += moduleStats.totalErrors;
  });

  const totalRequests = totalHits + totalMisses;
  const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

  return {
    totalHits,
    totalMisses,
    totalErrors,
    hitRate: Math.round(hitRate * 100) / 100,
    moduleCount: Object.keys(metrics).length,
    modules: moduleMetrics,
  };
}

/**
 * Reset metrics for a specific user and module
 */
export function resetCacheMetrics(module?: string, userId?: string): void {
  if (module && userId) {
    if (metrics[module] && metrics[module][userId]) {
      Object.keys(metrics[module][userId]).forEach((resource) => {
        metrics[module][userId][resource] = {
          hits: 0,
          misses: 0,
          errors: 0,
          lastReset: new Date(),
        };
      });
    }
  } else if (module) {
    if (metrics[module]) {
      delete metrics[module];
    }
  } else {
    // Reset all metrics
    Object.keys(metrics).forEach((key) => {
      delete metrics[key];
    });
  }

  logger.info("Cache metrics reset", { module, userId });
}

/**
 * Log current cache metrics to console/logger
 */
export function logCacheMetrics(): void {
  const globalMetrics = getGlobalCacheMetrics();

  logger.info("Cache Metrics Summary", {
    global: {
      totalHits: globalMetrics.totalHits,
      totalMisses: globalMetrics.totalMisses,
      totalErrors: globalMetrics.totalErrors,
      hitRate: `${globalMetrics.hitRate}%`,
      moduleCount: globalMetrics.moduleCount,
    },
    modules: globalMetrics.modules,
  });
}

/**
 * Start periodic metrics logging (optional)
 * @param intervalMinutes - Interval in minutes to log metrics
 * @returns Timer ID that can be used to stop logging
 */
export function startPeriodicLogging(intervalMinutes: number = 60): NodeJS.Timeout {
  const intervalMs = intervalMinutes * 60 * 1000;

  return setInterval(() => {
    logCacheMetrics();
  }, intervalMs);
}

/**
 * Stop periodic metrics logging
 * @param timerId - Timer ID returned from startPeriodicLogging
 */
export function stopPeriodicLogging(timerId: NodeJS.Timeout): void {
  clearInterval(timerId);
  logger.info("Periodic cache metrics logging stopped");
}
