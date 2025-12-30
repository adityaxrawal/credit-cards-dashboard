/**
 * Transactions Controller Integration Tests
 * Tests for transaction API endpoints
 */

import { Request, Response, NextFunction } from 'express';

// Mock dependencies before importing controller
jest.mock('../../services/transactions/TransactionService', () => ({
    __esModule: true,
    TransactionService: {
        listTransactions: jest.fn(),
        getTransaction: jest.fn(),
        createManualTransaction: jest.fn(),
        updateTransaction: jest.fn(),
        deleteTransaction: jest.fn(),
        bulkUpdateTransactions: jest.fn(),
        bulkDeleteTransactions: jest.fn(),
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

import * as transactionsController from '../../controllers/transactions.controller';
import { TransactionService } from '../../services/transactions/TransactionService';

const mockTransactionService = TransactionService as jest.Mocked<typeof TransactionService>;

describe('Transactions Controller', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            user: { id: 'user-123' },
            params: {},
            query: {},
            body: {},
        };
        mockRes = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('listTransactions', () => {
        it('should return paginated transactions', async () => {
            const mockData = {
                data: [
                    { id: 'tx-1', amount: 500, merchant: 'Amazon' },
                    { id: 'tx-2', amount: 300, merchant: 'Swiggy' },
                ],
                total: 2,
            };
            mockTransactionService.listTransactions.mockResolvedValue(mockData);

            await transactionsController.listTransactions(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: mockData.data,
                pagination: expect.objectContaining({
                    total: 2,
                }),
            });
        });

        it('should pass filters to service', async () => {
            mockReq.query = {
                from: '2024-01-01',
                to: '2024-01-31',
                category: 'Food',
            };
            mockTransactionService.listTransactions.mockResolvedValue({ data: [], total: 0 });

            await transactionsController.listTransactions(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockTransactionService.listTransactions).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({
                    category: 'Food',
                })
            );
        });

        it('should handle errors', async () => {
            mockTransactionService.listTransactions.mockRejectedValue(new Error('DB Error'));

            await transactionsController.listTransactions(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('getTransaction', () => {
        it('should return single transaction', async () => {
            const mockTx = { id: 'tx-1', amount: 500, merchant: 'Amazon' };
            mockReq.params = { id: 'tx-1' };
            mockTransactionService.getTransaction.mockResolvedValue(mockTx);

            await transactionsController.getTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({ data: mockTx });
        });

        it('should return 404 for non-existent transaction', async () => {
            mockReq.params = { id: 'non-existent' };
            mockTransactionService.getTransaction.mockResolvedValue(null);

            await transactionsController.getTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('createTransaction', () => {
        it('should create manual transaction', async () => {
            mockReq.body = {
                merchant: 'Test Merchant',
                amount: 1000,
                category: 'Shopping',
                transactionDate: '2024-01-15',
                transactionType: 'credit_card_spend',
            };
            mockTransactionService.createManualTransaction.mockResolvedValue({
                id: 'new-tx',
                ...mockReq.body,
            });

            await transactionsController.createTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ id: 'new-tx' }),
            });
        });

        it('should validate required fields', async () => {
            mockReq.body = { amount: 100 }; // Missing merchant and other required fields

            await transactionsController.createTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('updateTransaction', () => {
        it('should update transaction', async () => {
            mockReq.params = { id: 'tx-1' };
            mockReq.body = { category: 'New Category' };
            mockTransactionService.updateTransaction.mockResolvedValue({
                id: 'tx-1',
                category: 'New Category',
            });

            await transactionsController.updateTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ category: 'New Category' }),
            });
        });
    });

    describe('deleteTransaction', () => {
        it('should delete transaction', async () => {
            mockReq.params = { id: 'tx-1' };
            mockTransactionService.deleteTransaction.mockResolvedValue(true);

            await transactionsController.deleteTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(204);
        });

        it('should return 404 if transaction not found', async () => {
            mockReq.params = { id: 'non-existent' };
            mockTransactionService.deleteTransaction.mockResolvedValue(false);

            await transactionsController.deleteTransaction(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('bulkUpdateTransactions', () => {
        it('should update multiple transactions', async () => {
            mockReq.body = {
                transactionIds: ['tx-1', 'tx-2', 'tx-3'],
                updates: { category: 'Food' },
            };
            mockTransactionService.bulkUpdateTransactions.mockResolvedValue({
                updated: 3,
                failed: 0,
            });

            await transactionsController.bulkUpdateTransactions(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: { updated: 3, failed: 0 },
            });
        });

        it('should reject empty transaction list', async () => {
            mockReq.body = { transactionIds: [], updates: {} };

            await transactionsController.bulkUpdateTransactions(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('bulkDeleteTransactions', () => {
        it('should delete multiple transactions', async () => {
            mockReq.body = { transactionIds: ['tx-1', 'tx-2'] };
            mockTransactionService.bulkDeleteTransactions.mockResolvedValue({
                deleted: 2,
                failed: 0,
            });

            await transactionsController.bulkDeleteTransactions(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: { deleted: 2, failed: 0 },
            });
        });
    });
});
