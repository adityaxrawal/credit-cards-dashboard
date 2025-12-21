import { invalidateBillsCache, invalidateBudgetCache } from '../src/utils/cacheInvalidation';
import * as cacheMiddleware from '../src/middleware/cache.middleware';

// Mock cache middleware
jest.mock('../src/middleware/cache.middleware', () => ({
    clearCache: jest.fn()
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn()
}));

describe('Cache Invalidation Strategy', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should invalidate bills cache correctly', async () => {
        await invalidateBillsCache(userId);

        expect(cacheMiddleware.clearCache).toHaveBeenCalledTimes(1);
        expect(cacheMiddleware.clearCache).toHaveBeenCalledWith(userId, 'bills');
    });

    it('should invalidate budget cache correctly', async () => {
        await invalidateBudgetCache(userId);

        expect(cacheMiddleware.clearCache).toHaveBeenCalledTimes(1);
        expect(cacheMiddleware.clearCache).toHaveBeenCalledWith(userId, 'budget');
    });
});
