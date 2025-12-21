import { queryCache } from '../../../utils/queryCache';

describe('QueryCache', () => {
    beforeEach(() => {
        queryCache.flushAll();
    });

    describe('Basic Operations', () => {
        test('should store and retrieve values', () => {
            const key = 'test-key';
            const value = { data: 'test-value' };

            queryCache.set(key, value);
            const retrieved = queryCache.get(key);

            expect(retrieved).toEqual(value);
        });

        test('should return undefined for missing keys', () => {
            const result = queryCache.get('non-existent');
            expect(result).toBeUndefined();
        });

        test('should delete specific keys', () => {
            queryCache.set('key1', 'value1');
            queryCache.set('key2', 'value2');

            const deleted = queryCache.del('key1');
            expect(deleted).toBe(1);
            expect(queryCache.get('key1')).toBeUndefined();
            expect(queryCache.get('key2')).toBe('value2');
        });

        test('should flush all cache', () => {
            queryCache.set('key1', 'value1');
            queryCache.set('key2', 'value2');

            queryCache.flushAll();

            expect(queryCache.get('key1')).toBeUndefined();
            expect(queryCache.get('key2')).toBeUndefined();
        });
    });

    describe('Pattern Deletion', () => {
        test('should delete keys matching pattern', () => {
            queryCache.set('user:123:transactions', 'data1');
            queryCache.set('user:123:bills', 'data2');
            queryCache.set('user:456:transactions', 'data3');

            const deleted = queryCache.delPattern('user:123');

            expect(deleted).toBe(2);
            expect(queryCache.get('user:123:transactions')).toBeUndefined();
            expect(queryCache.get('user:123:bills')).toBeUndefined();
            expect(queryCache.get('user:456:transactions')).toBe('data3');
        });
    });

    describe('TTL Handling', () => {
        test('should expire keys after TTL', async () => {
            const key = 'ttl-test';
            queryCache.set(key, 'value', 1); // 1 second TTL

            expect(queryCache.get(key)).toBe('value');

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1200));

            expect(queryCache.get(key)).toBeUndefined();
        });
    });

    describe('Helper Functions', () => {
        test('should generate user-specific cache keys', () => {
            const key1 = queryCache.constructor.userKey('user123', 'transactions');
            const key2 = queryCache.constructor.userKey('user123', 'transactions', { limit: 10 });

            expect(key1).toBe('user:user123:transactions');
            expect(key2).toContain('user:user123:transactions');
            expect(key2).toContain('limit');
        });

        test('should generate global cache keys', () => {
            const key = queryCache.constructor.globalKey('stats', 'daily');

            expect(key).toContain('global:stats');
            expect(key).toContain('daily');
        });
    });

    describe('Statistics', () => {
        test('should provide cache statistics', () => {
            queryCache.set('key1', 'value1');
            queryCache.set('key2', 'value2');

            const stats = queryCache.getStats();

            expect(stats.keys).toBe(2);
            expect(stats.hits).toBeGreaterThanOrEqual(0);
            expect(stats.misses).toBeGreaterThanOrEqual(0);
        });
    });
});
