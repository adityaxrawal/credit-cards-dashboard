/**
 * Transactions Service Unit Tests
 * Tests transaction CRUD operations
 */

import * as transactionsService from '../../services/transactions.service';
import pool from '../../lib/db';

// Mock database
jest.mock('../../lib/db', () => ({
    query: jest.fn(),
}));

describe('Transactions Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listTransactions', () => {
        it('should return paginated transactions', async () => {
            const mockTransactions = [
                { id: '1', merchant: 'Amazon', amount: 100 },
                { id: '2', merchant: 'Netflix', amount: 15 },
            ];

            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: mockTransactions,
            });

            const result = await transactionsService.listTransactions('user-123', {
                page: 1,
                limit: 50,
            });

            expect(pool.query).toHaveBeenCalled();
            expect(result.data).toEqual(mockTransactions);
        });

        it('should handle empty results', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            const result = await transactionsService.listTransactions('user-123', {});

            expect(result.data).toEqual([]);
        });
    });

    describe('getTransaction', () => {
        it('should return a single transaction if found', async () => {
            const mockTransaction = { id: '1', merchant: 'Amazon', amount: 100 };

            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockTransaction],
            });

            const result = await transactionsService.getTransaction('user-123', '1');

            expect(result).toEqual(mockTransaction);
        });

        it('should return null if not found', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            const result = await transactionsService.getTransaction('user-123', 'invalid');

            expect(result).toBeNull();
        });
    });

    describe('createManualTransaction', () => {
        it('should create a new transaction', async () => {
            const newTransaction = {
                userId: 'user-123',
                cardId: 'card-456',
                transactionDate: new Date(),
                merchant: 'Test Store',
                category: 'Shopping',
                amount: 50,
                transactionType: 'debit',
                description: 'Test purchase',
            };

            const mockCreated = { id: 'new-id', ...newTransaction };

            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [mockCreated],
            });

            const result = await transactionsService.createManualTransaction(newTransaction);

            expect(pool.query).toHaveBeenCalled();
            expect(result).toEqual(mockCreated);
        });
    });

    describe('deleteTransaction', () => {
        it('should return true if deleted', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 1 });

            const result = await transactionsService.deleteTransaction('user-123', '1');

            expect(result).toBe(true);
        });

        it('should return false if not found', async () => {
            (pool.query as jest.Mock).mockResolvedValueOnce({ rowCount: 0 });

            const result = await transactionsService.deleteTransaction('user-123', 'invalid');

            expect(result).toBe(false);
        });
    });
});
