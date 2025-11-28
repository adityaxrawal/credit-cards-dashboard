import { Redis } from '@upstash/redis';
import { env } from '../config/env';

// Initialize Upstash Redis client
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL!,
  token: env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Cache management utilities
 */
export class CacheManager {
  /**
   * Get cached value
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      return value as T | null;
    } catch (error) {
      console.error(`[Redis] Error getting key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with optional expiration
   */
  static async set(key: string, value: any, expirationSeconds?: number): Promise<void> {
    try {
      if (expirationSeconds) {
        await redis.setex(key, expirationSeconds, JSON.stringify(value));
      } else {
        await redis.set(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(`[Redis] Error setting key ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error(`[Redis] Error deleting key ${key}:`, error);
    }
  }

  /**
   * Delete all keys matching pattern
   */
  static async deletePattern(pattern: string): Promise<void> {
    try {
      // Note: Upstash Redis may not support SCAN, use with caution
      // For now, individual key deletion is recommended
      console.warn(`[Redis] Pattern deletion not fully supported in Upstash`);
    } catch (error) {
      console.error(`[Redis] Error deleting pattern ${pattern}:`, error);
    }
  }

  /**
   * Increment counter
   */
  static async increment(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.error(`[Redis] Error incrementing key ${key}:`, error);
      return 0;
    }
  }
}

export default redis;
