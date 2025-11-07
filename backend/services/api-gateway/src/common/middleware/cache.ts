import { Request, Response, NextFunction } from "express";
import redis from "shared/cache/redis";
import { logger } from "shared/monitoring/logger";
import { AuthRequest } from "./auth";

/**
 * Cache middleware options
 */
interface CacheOptions {
  ttl: number; // Time to live in seconds
  keyPrefix: string; // Prefix for cache key
  includeUserId?: boolean; // Whether to include user ID in cache key
  includeQuery?: boolean; // Whether to include query params in cache key
}

/**
 * Generate cache key based on request and options
 */
function generateCacheKey(req: Request | AuthRequest, options: CacheOptions): string {
  const parts: string[] = [options.keyPrefix];

  // Add user ID if required
  if (options.includeUserId && "userId" in req) {
    parts.push((req as AuthRequest).userId!);
  }

  // Add path params
  if (Object.keys(req.params).length > 0) {
    parts.push(Object.values(req.params).join(":"));
  }

  // Add query params if required
  if (options.includeQuery && Object.keys(req.query).length > 0) {
    const queryString = Object.entries(req.query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    parts.push(queryString);
  }

  return parts.join(":");
}

/**
 * Cache middleware factory
 * Creates middleware that caches GET requests
 */
export function cache(options: CacheOptions) {
  return async (req: Request | AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== "GET") {
      next();
      return;
    }

    try {
      const cacheKey = generateCacheKey(req, options);

      // Try to get from cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for key: ${cacheKey}`);
        res.status(200).json(JSON.parse(cached));
        return;
      }

      logger.debug(`Cache miss for key: ${cacheKey}`);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (body: unknown): Response {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis
            .set(cacheKey, JSON.stringify(body), "EX", options.ttl)
            .then(() => {
              logger.debug(`Cached response for key: ${cacheKey}`);
            })
            .catch((cacheError) => {
              logger.error("Cache set failed", cacheError as Error);
            });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error("Cache middleware error", error as Error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    // Note: This requires Redis SCAN command support
    // For production, consider using Redis key patterns or tags
    logger.info(`Invalidating cache pattern: ${pattern}`);

    // Since we're using Upstash/ioredis, we need to handle this differently
    // For now, we'll just log the invalidation request
    // In production, implement proper cache invalidation strategy
    logger.warn("Cache invalidation not fully implemented - consider using cache tags");
  } catch (error) {
    logger.error("Cache invalidation failed", error as Error);
  }
}

/**
 * Clear specific cache key
 */
export async function clearCache(key: string): Promise<void> {
  try {
    await redis.del(key);
    logger.debug(`Cleared cache key: ${key}`);
  } catch (error) {
    logger.error("Clear cache failed", error as Error);
  }
} /**
 * Predefined cache configurations for common use cases
 */
export const CacheConfig = {
  // Short-lived cache for frequently changing data (60 seconds)
  SHORT: { ttl: 60 },

  // Medium-lived cache for analytics data (120 seconds)
  MEDIUM: { ttl: 120 },

  // Long-lived cache for reports and aggregated data (300 seconds)
  LONG: { ttl: 300 },

  // Very short cache for real-time data (30 seconds)
  REALTIME: { ttl: 30 },
};
