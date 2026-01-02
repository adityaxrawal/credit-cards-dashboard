/**
 * Cache Invalidation Utilities
 * 
 * Provides helper functions for invalidating related caches when data changes.
 * Call these after database writes to ensure cache consistency.
 */

import { clearCache } from '@shared/middleware/cache.middleware';
import logger from '../infrastructure/logger';

/**
 * Invalidate all transaction-related caches for a user
 * Call after creating/updating/deleting transactions
 */
export async function invalidateTransactionCache(userId: string): Promise<void> {
    try {
        await Promise.all([
            clearCache(userId, 'transactions'),
            clearCache(userId, 'analytics'),
            clearCache(userId, 'statements')
        ]);
        logger.debug('cache_invalidated', { userId, scope: 'transactions' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate card-related caches for a user
 * Call after creating/updating/deleting cards
 */
export async function invalidateCardCache(userId: string, cardId?: string): Promise<void> {
    try {
        await Promise.all([
            clearCache(userId, 'cards'),
            clearCache(userId, 'analytics'),
            cardId ? clearCache(userId, `card/${cardId}`) : Promise.resolve()
        ]);
        logger.debug('cache_invalidated', { userId, cardId, scope: 'cards' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate alert-related caches for a user
 * Call after creating/updating/deleting alerts
 */
export async function invalidateAlertCache(userId: string): Promise<void> {
    try {
        await clearCache(userId, 'alerts');
        logger.debug('cache_invalidated', { userId, scope: 'alerts' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate all analytics caches for a user
 * Call after any significant data change that affects analytics
 */
export async function invalidateAnalyticsCache(userId: string): Promise<void> {
    try {
        await clearCache(userId, 'analytics');
        logger.debug('cache_invalidated', { userId, scope: 'analytics' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate all caches for a user
 * Use sparingly - prefer specific invalidation
 */
export async function invalidateAllUserCache(userId: string): Promise<void> {
    try {
        await clearCache(userId, '*');
        logger.info('cache_invalidated_all', { userId });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate bills-related caches for a user
 * Call after creating/updating/deleting bills
 */
export async function invalidateBillsCache(userId: string): Promise<void> {
    try {
        await clearCache(userId, 'bills');
        logger.debug('cache_invalidated', { userId, scope: 'bills' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate budget-related caches for a user
 * Call after updating budget settings
 */
export async function invalidateBudgetCache(userId: string): Promise<void> {
    try {
        await clearCache(userId, 'budget');
        logger.debug('cache_invalidated', { userId, scope: 'budget' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}

/**
 * Invalidate accounts/instruments cache
 */
export async function invalidateAccountsCache(userId: string): Promise<void> {
    try {
        await Promise.all([
            clearCache(userId, 'accounts'),
            clearCache(userId, 'cards'),
            clearCache(userId, 'analytics')
        ]);
        logger.debug('cache_invalidated', { userId, scope: 'accounts' });
    } catch (error) {
        logger.error('cache_invalidation_failed', { userId, error });
    }
}
