import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import redis from '../lib/redis';

/**
 * Generate weak ETag from response body
 */
function generateETag(body: any): string {
  const hash = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
  return `W/"${hash.substring(0, 16)}"`;
}

/**
 * Cache middleware with ETag support
 * 
 * DESIGN DECISIONS:
 * 1. Uses weak ETags for semantic equivalence (W/"...")
 * 2. Short-circuits BEFORE service calls when ETag matches
 * 3. Falls back to Redis cache for full response
 * @param durationSeconds Duration in seconds to cache the response
 */
export const cache = (durationSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if Redis is not initialized or if it's not a GET request
    if (!redis || req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}:${(req as any).user?.id || 'public'}`;
    const etagKey = `etag:${key}`;

    try {
      // Check If-None-Match header for ETag validation
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag) {
        const storedEtag = await redis.get(etagKey);
        if (storedEtag && clientEtag === storedEtag) {
          // Short-circuit: Return 304 WITHOUT hitting DB or service
          return res.status(304).end();
        }
      }

      // Check Redis cache for full response
      const cachedResponse = await redis.get(key);
      if (cachedResponse) {
        const etag = generateETag(cachedResponse);
        res.set('ETag', etag);
        res.set('Cache-Control', `private, max-age=${durationSeconds}`);
        return res.json(cachedResponse);
      }

      // Override res.json to cache the response before sending
      const originalJson = res.json;
      res.json = (body: any) => {
        const etag = generateETag(body);
        res.set('ETag', etag);
        res.set('Cache-Control', `private, max-age=${durationSeconds}`);

        // Cache the response and ETag asynchronously
        Promise.all([
          redis?.set(key, body, { ex: durationSeconds }),
          redis?.set(etagKey, etag, { ex: durationSeconds })
        ]).catch(err => {
          console.error('Redis cache error:', err);
        });

        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Redis middleware error:', error);
      next();
    }
  };
};

/**
 * Clear cache for a specific user and pattern
 * @param userId User ID
 * @param pattern Pattern to match (e.g. "analytics*")
 */
export const clearCache = async (userId: string, pattern: string) => {
  if (!redis) return;

  try {
    const keys = await redis.keys(`cache:*${pattern}*:${userId}`);
    const etagKeys = await redis.keys(`etag:cache:*${pattern}*:${userId}`);
    const allKeys = [...keys, ...etagKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  } catch (error) {
    console.error('Redis clear cache error:', error);
  }
};

