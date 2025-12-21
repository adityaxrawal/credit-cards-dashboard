import { createTransaction } from '../src/controllers/transactions.controller';
import { createCard } from '../src/controllers/cards.controller';
import * as transactionsService from '../src/services/transactions.service';
import * as cardsService from '../src/services/cards.service';
import { Request, Response } from 'express';

// Mock services
jest.mock('../src/services/transactions.service');
jest.mock('../src/services/cards.service');

describe('Input Validation', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let next: jest.Mock;

    beforeEach(() => {
        mockReq = {
            body: {},
            user: { id: 'user-1' }
        } as any;
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    describe('Transactions Validation', () => {
        it('should fail with invalid data', async () => {
            mockReq.body = { amount: -100 }; // Invalid negative amount

            await createTransaction(mockReq as Request, mockRes as Response, next);

            expect(mockRes.status).toHaveBeenCalledWith(422);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.objectContaining({
                    code: 'VALIDATION_ERROR'
                })
            }));
        });

        it('should succeed with valid data', async () => {
            mockReq.body = {
                amount: 100,
                merchant: 'Test Merchant',
                transactionDate: new Date().toISOString(),
                category: 'Food',
                transactionType: 'debit',
                cardId: '123e4567-e89b-12d3-a456-426614174000' // Valid UUID
            };

            (transactionsService.createManualTransaction as jest.Mock).mockResolvedValue({ id: 'tx-123' });

            await createTransaction(mockReq as Request, mockRes as Response, next);

            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ id: 'tx-123' })
            }));
        });
    });

    describe('Cards Validation', () => {
        it('should fail with missing required fields', async () => {
            mockReq.body = { cardName: 'Test Card' }; // Missing bankName etc

            await createCard(mockReq as unknown as Request, mockRes as unknown as Response, next);

            expect(mockRes.status).toHaveBeenCalledWith(422);
        });
    });
});
