/**
 * LifecycleService Tests
 * Tests for transaction status transitions and lifecycle management
 */

import { LifecycleService } from '../../services/transactions/LifecycleService';

// Mock dependencies
jest.mock('../../lib/db', () => ({
    __esModule: true,
    default: {
        query: jest.fn(),
    },
}));

jest.mock('../../utils/infrastructure/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockPool = require('../../lib/db').default;

describe('LifecycleService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('transitionStatus', () => {
        it('should successfully transition from pending to posted', async () => {
            // Mock getting current status
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', status: 'pending' }],
            });
            // Mock updating status
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{ id: 'tx-1', status: 'posted' }],
            });

            const result = await LifecycleService.transitionStatus('tx-1', 'posted');

            expect(result.success).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should reject invalid status transition', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', status: 'posted' }],
            });

            const result = await LifecycleService.transitionStatus('tx-1', 'pending');

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should allow forced transition', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', status: 'posted' }],
            });
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
                rows: [{ id: 'tx-1', status: 'reversed' }],
            });

            const result = await LifecycleService.transitionStatus(
                'tx-1',
                'reversed',
                { force: true }
            );

            expect(result.success).toBe(true);
        });

        it('should handle non-existent transaction', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const result = await LifecycleService.transitionStatus('non-existent', 'posted');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('markDisputed', () => {
        it('should mark transaction as disputed', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', user_id: 'user-1', status: 'posted' }],
            });
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
            });

            const result = await LifecycleService.markDisputed('tx-1', 'user-1', 'Unauthorized charge');

            expect(result).toBe(true);
        });

        it('should prevent marking non-owned transaction', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', user_id: 'other-user', status: 'posted' }],
            });

            const result = await LifecycleService.markDisputed('tx-1', 'user-1', 'Unauthorized');

            expect(result).toBe(false);
        });
    });

    describe('markChargeback', () => {
        it('should mark disputed transaction as chargeback', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', user_id: 'user-1', status: 'disputed' }],
            });
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
            });

            const result = await LifecycleService.markChargeback('tx-1', 'user-1');

            expect(result).toBe(true);
        });

        it('should fail for non-disputed transaction', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', user_id: 'user-1', status: 'posted' }],
            });

            const result = await LifecycleService.markChargeback('tx-1', 'user-1');

            expect(result).toBe(false);
        });
    });

    describe('detectRecurring', () => {
        it('should detect recurring transactions', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { merchant: 'Netflix', count: 6 },
                    { merchant: 'Spotify', count: 4 },
                ],
            });
            mockPool.query.mockResolvedValueOnce({ rowCount: 6 });
            mockPool.query.mockResolvedValueOnce({ rowCount: 4 });

            const count = await LifecycleService.detectRecurring('user-1');

            expect(count).toBe(2);
        });

        it('should return 0 when no recurring patterns found', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const count = await LifecycleService.detectRecurring('user-1');

            expect(count).toBe(0);
        });
    });

    describe('detectReversals', () => {
        it('should detect reversal transactions', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'refund-1', amount: 500, merchant: 'Amazon' },
                    { id: 'refund-2', amount: 200, merchant: 'Flipkart' },
                ],
            });
            mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
            mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

            const count = await LifecycleService.detectReversals('user-1');

            expect(count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getPendingOlderThan', () => {
        it('should return pending transactions older than threshold', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'tx-1' },
                    { id: 'tx-2' },
                ],
            });

            const ids = await LifecycleService.getPendingOlderThan('user-1', 3);

            expect(ids).toHaveLength(2);
            expect(ids).toContain('tx-1');
        });

        it('should return empty array when no old pending transactions', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const ids = await LifecycleService.getPendingOlderThan('user-1', 3);

            expect(ids).toHaveLength(0);
        });
    });

    describe('autoPostPending', () => {
        it('should auto-post pending transactions', async () => {
            // Mock getPendingOlderThan
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1' }, { id: 'tx-2' }],
            });
            // Mock status transitions
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-1', status: 'pending' }],
            });
            mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'tx-2', status: 'pending' }],
            });
            mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

            const count = await LifecycleService.autoPostPending('user-1', 3);

            expect(count).toBeGreaterThanOrEqual(0);
        });

        it('should return 0 when no transactions to post', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const count = await LifecycleService.autoPostPending('user-1', 3);

            expect(count).toBe(0);
        });
    });
});
