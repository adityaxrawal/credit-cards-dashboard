/**
 * Bills Controller Tests
 * Tests for bill management API endpoints
 */

import { Request, Response, NextFunction } from 'express';

// Mock dependencies
jest.mock('../../db/queries/bills.queries', () => ({
    listBills: jest.fn(),
    getBillById: jest.fn(),
    createBill: jest.fn(),
    updateBill: jest.fn(),
    deleteBill: jest.fn(),
    markBillPaid: jest.fn(),
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

import * as billsController from '../../controllers/bills.controller';
import * as billsQueries from '../../db/queries/bills.queries';

const mockBillsQueries = billsQueries as jest.Mocked<typeof billsQueries>;

describe('Bills Controller', () => {
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

    describe('listBills', () => {
        it('should return list of bills', async () => {
            const mockBills = [
                { id: 'bill-1', cardId: 'card-1', amount: 25000, dueDate: new Date() },
                { id: 'bill-2', cardId: 'card-2', amount: 15000, dueDate: new Date() },
            ];
            mockBillsQueries.listBills.mockResolvedValue({ data: mockBills, total: 2 });

            await billsController.listBills(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: mockBills,
                })
            );
        });

        it('should filter by card ID', async () => {
            mockReq.query = { cardId: 'card-1' };
            mockBillsQueries.listBills.mockResolvedValue({ data: [], total: 0 });

            await billsController.listBills(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockBillsQueries.listBills).toHaveBeenCalledWith(
                'user-123',
                expect.objectContaining({ cardId: 'card-1' })
            );
        });
    });

    describe('getBill', () => {
        it('should return single bill', async () => {
            const mockBill = { id: 'bill-1', amount: 25000 };
            mockReq.params = { id: 'bill-1' };
            mockBillsQueries.getBillById.mockResolvedValue(mockBill);

            await billsController.getBill(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({ data: mockBill });
        });

        it('should return 404 for non-existent bill', async () => {
            mockReq.params = { id: 'non-existent' };
            mockBillsQueries.getBillById.mockResolvedValue(null);

            await billsController.getBill(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('createBill', () => {
        it('should create a new bill', async () => {
            mockReq.body = {
                cardId: 'card-1',
                amount: 25000,
                billMonth: 1,
                billYear: 2024,
                dueDate: '2024-01-20',
            };
            mockBillsQueries.createBill.mockResolvedValue({ id: 'new-bill', ...mockReq.body });

            await billsController.createBill(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(201);
        });

        it('should validate required fields', async () => {
            mockReq.body = { amount: 1000 }; // Missing cardId

            await billsController.createBill(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('updateBill', () => {
        it('should update bill', async () => {
            mockReq.params = { id: 'bill-1' };
            mockReq.body = { amount: 30000 };
            mockBillsQueries.updateBill.mockResolvedValue({ id: 'bill-1', amount: 30000 });

            await billsController.updateBill(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ amount: 30000 }),
            });
        });
    });

    describe('deleteBill', () => {
        it('should delete bill', async () => {
            mockReq.params = { id: 'bill-1' };
            mockBillsQueries.deleteBill.mockResolvedValue(true);

            await billsController.deleteBill(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.status).toHaveBeenCalledWith(204);
        });
    });

    describe('markBillPaid', () => {
        it('should mark bill as paid', async () => {
            mockReq.params = { id: 'bill-1' };
            mockReq.body = { paidAmount: 25000, paidDate: '2024-01-15' };
            mockBillsQueries.markBillPaid.mockResolvedValue({
                id: 'bill-1',
                isPaid: true,
                paidAmount: 25000,
            });

            await billsController.markBillPaid(
                mockReq as Request,
                mockRes as Response,
                mockNext
            );

            expect(mockRes.json).toHaveBeenCalledWith({
                data: expect.objectContaining({ isPaid: true }),
            });
        });
    });
});
