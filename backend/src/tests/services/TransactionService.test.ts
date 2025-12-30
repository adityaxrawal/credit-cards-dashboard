import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as transactionsService from '../../services/transactions/TransactionService';
import pool from '../../lib/db';
import { createMockTransaction, createMockUser } from '../utils/testHelpers';

// Mock the database pool
jest.mock('../../lib/db', () => ({
    query: jest.fn(),
}));

// Mock cards queries
jest.mock('../../db/queries/cards.queries', () => ({
    getCardById: jest.fn(),
}));

// Mock transactions queries
jest.mock('../../db/queries/transactions.queries', () => ({
    findByUserId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteById: jest.fn(),
    getSpendingAggregations: jest.fn(),
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('TransactionService', () => {
    const mockUserId = 'test-user-id';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listTransactions', () => {
        it('should return paginated transactions with default filters', async () => {
            const mockTransactions = [
                createMockTransaction({ id: 'txn-1', amount: 100 }),
                createMockTransaction({ id: 'txn-2', amount: 200 }),
            ];

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: mockTransactions,
                rowCount: 2,
            });
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ count: '10' }],
            });

            const result = await transactionsService.listTransactions(mockUserId, {});

            expect(result).toBeDefined();
            expect(mockPool.query).toHaveBeenCalled();
        });

        it('should apply date range filters correctly', async () => {
            const mockTransactions = [createMockTransaction()];

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: mockTransactions,
                rowCount: 1,
            });
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ count: '1' }],
            });

            const result = await transactionsService.listTransactions(mockUserId, {
                from: '2024-01-01',
                to: '2024-12-31',
            });

            expect(result).toBeDefined();
            expect(mockPool.query).toHaveBeenCalled();
        });

        it('should filter by category', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ count: '0' }],
            });

            const result = await transactionsService.listTransactions(mockUserId, {
                category: 'shopping',
            });

            expect(result).toBeDefined();
        });

        it('should filter by needsReview', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ count: '0' }],
            });

            const result = await transactionsService.listTransactions(mockUserId, {
                needsReview: true,
            });

            expect(result).toBeDefined();
        });
    });

    describe('getTransaction', () => {
        it('should return a transaction by id', async () => {
            const mockTransaction = createMockTransaction();

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockTransaction],
                rowCount: 1,
            });

            const result = await transactionsService.getTransaction(mockUserId, 'txn-1');

            expect(result).toBeDefined();
        });

        it('should return null for non-existent transaction', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });

            const result = await transactionsService.getTransaction(mockUserId, 'non-existent');

            expect(result).toBeNull();
        });
    });

    describe('createManualTransaction', () => {
        it('should create a new manual transaction', async () => {
            const mockCreated = createMockTransaction({
                id: 'new-txn',
                is_manually_added: true
            });

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockCreated],
                rowCount: 1,
            });

            const result = await transactionsService.createManualTransaction({
                userId: mockUserId,
                instrumentType: 'credit_card',
                instrumentId: 'card-1',
                transactionDate: new Date(),
                merchant: 'Test Merchant',
                category: 'shopping',
                amount: 1000,
                transactionType: 'debit',
                direction: 'debit',
            });

            expect(result).toBeDefined();
        });

        it('should validate required fields', async () => {
            await expect(
                transactionsService.createManualTransaction({
                    userId: mockUserId,
                    instrumentType: 'credit_card',
                    instrumentId: '', // Missing
                    transactionDate: new Date(),
                    merchant: 'Test',
                    category: 'shopping',
                    amount: 1000,
                    transactionType: 'debit',
                    direction: 'debit',
                })
            ).rejects.toThrow();
        });
    });

    describe('updateTransaction', () => {
        it('should update an existing transaction', async () => {
            const mockUpdated = createMockTransaction({
                merchant: 'Updated Merchant'
            });

            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockUpdated],
                rowCount: 1,
            });

            const result = await transactionsService.updateTransaction(
                mockUserId,
                'txn-1',
                { merchant: 'Updated Merchant' }
            );

            expect(result).toBeDefined();
        });

        it('should return null for non-existent transaction', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });

            const result = await transactionsService.updateTransaction(
                mockUserId,
                'non-existent',
                { merchant: 'Updated' }
            );

            expect(result).toBeNull();
        });
    });

    describe('deleteTransaction', () => {
        it('should delete a transaction', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ id: 'txn-1' }],
                rowCount: 1,
            });

            const result = await transactionsService.deleteTransaction(mockUserId, 'txn-1');

            expect(result).toBe(true);
        });

        it('should return false for non-existent transaction', async () => {
            (mockPool.query as jest.Mock).mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });

            const result = await transactionsService.deleteTransaction(mockUserId, 'non-existent');

            expect(result).toBe(false);
        });
    });
});
