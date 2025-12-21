import NodeCache from 'node-cache';
import logger from '../infrastructure/logger';

/**
 * Query result cache using LRU eviction
 * TTL: 5 minutes for most queries, configurable per query
 */
class QueryCache {
    private cache: NodeCache;

    constructor() {
        this.cache = new NodeCache({
            stdTTL: 300, // 5 minutes default
            checkperiod: 60, // Check for expired keys every 60s
            useClones: false, // Don't clone objects for performance
            maxKeys: 1000 // Limit cache size
        });

        // Log cache stats periodically in development
        if (process.env.NODE_ENV === 'development') {
            setInterval(() => {
                const stats = this.cache.getStats();
                if (stats.keys > 0) {
                    logger.debug('[QueryCache] Stats', stats);
                }
            }, 60000);
        }
    }

    /**
     * Get cached query result
     */
    get<T>(key: string): T | undefined {
        const value = this.cache.get<T>(key);
        if (value) {
            logger.debug(`[QueryCache] HIT: ${key}`);
        } else {
            logger.debug(`[QueryCache] MISS: ${key}`);
        }
        return value;
    }

    /**
     * Set query result in cache
     * @param key Cache key
     * @param value Value to cache
     * @param ttl Time to live in seconds (optional, defaults to 5 minutes)
     */
    set<T>(key: string, value: T, ttl?: number): boolean {
        const success = this.cache.set(key, value, ttl || 300);
        if (success) {
            logger.debug(`[QueryCache] SET: ${key} (TTL: ${ttl || 300}s)`);
        }
        return success;
    }

    /**
     * Delete specific cache key
     */
    del(key: string): number {
        return this.cache.del(key);
    }

    /**
     * Delete all keys matching pattern
     */
    delPattern(pattern: string): number {
        const keys = this.cache.keys();
        const matchingKeys = keys.filter(key => key.includes(pattern));
        if (matchingKeys.length > 0) {
            logger.debug(`[QueryCache] Deleting ${matchingKeys.length} keys matching: ${pattern}`);
            return this.cache.del(matchingKeys);
        }
        return 0;
    }

    /**
     * Clear all cache
     */
    flushAll(): void {
        this.cache.flushAll();
        logger.debug('[QueryCache] Flushed all cache');
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return this.cache.getStats();
    }

    /**
     * Helper: Generate cache key for user-specific queries
     */
    static userKey(userId: string, queryName: string, ...params: any[]): string {
        const paramStr = params.length > 0 ? `:${JSON.stringify(params)}` : '';
        return `user:${userId}:${queryName}${paramStr}`;
    }

    /**
     * Helper: Generate cache key for global queries
     */
    static globalKey(queryName: string, ...params: any[]): string {
        const paramStr = params.length > 0 ? `:${JSON.stringify(params)}` : '';
        return `global:${queryName}${paramStr}`;
    }
}

// Export singleton instance
export const queryCache = new QueryCache();

/**
 * Decorator for caching query results
 */
export function cacheQuery(ttl: number = 300) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;

            // Try to get from cache
            const cached = queryCache.get(cacheKey);
            if (cached !== undefined) {
                return cached;
            }

            // Execute query
            const result = await originalMethod.apply(this, args);

            // Store in cache
            queryCache.set(cacheKey, result, ttl);

            return result;
        };

        return descriptor;
    };
}
