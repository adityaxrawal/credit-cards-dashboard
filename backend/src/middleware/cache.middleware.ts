import { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis';

/**
 * Cache middleware
 * @param durationSeconds Duration in seconds to cache the response
 */
export const cache = (durationSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if Redis is not initialized or if it's not a GET request
    if (!redis || req.method !== 'GET') {
      return next();
    }

    const key = `cache:${req.originalUrl || req.url}:${(req as any).user?.id || 'public'}`;

    try {
      const cachedResponse = await redis.get(key);

      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      // Override res.json to cache the response before sending
      const originalJson = res.json;
      res.json = (body: any) => {
        // Cache the response asynchronously
        redis?.set(key, body, { ex: durationSeconds }).catch(err => {
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
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error('Redis clear cache error:', error);
  }
};
