/**
 * Example test for Bills Service
 * Demonstrates testing patterns for the backend
 */

import { billsService } from '../../services/bills.service';

// Mock the database queries
jest.mock('../../db/queries/bills.queries');
import * as billsQueries from '../../db/queries/bills.queries';

describe('BillsService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getAllBills', () => {
        it('should return all bills for a user', async () => {
            const mockBills = [
                {
                    id: 'bill-1',
                    card_name: 'Test Card',
                    bill_amount: 1000,
                    due_date: new Date('2025-01-15'),
                    payment_status: 'pending'
                }
            ];

            (billsQueries.getAllBills as jest.Mock).mockResolvedValue(mockBills);

            const result = await billsService.getAllBills('user-123');

            expect(result).toEqual(mockBills);
            expect(billsQueries.getAllBills).toHaveBeenCalledWith('user-123', 50, 0);
        });

        it('should support custom pagination', async () => {
            (billsQueries.getAllBills as jest.Mock).mockResolvedValue([]);

            await billsService.getAllBills('user-123', 10, 20);

            expect(billsQueries.getAllBills).toHaveBeenCalledWith('user-123', 10, 20);
        });
    });

    describe('getUpcomingBills', () => {
        it('should return upcoming unpaid bills', async () => {
            const mockUpcomingBills = [
                {
                    id: 'bill-1',
                    card_name: 'Test Card',
                    bill_amount: 5000,
                    due_date: new Date('2025-01-10'),
                    payment_status: 'pending'
                }
            ];

            (billsQueries.getUpcomingBills as jest.Mock).mockResolvedValue(mockUpcomingBills);

            const result = await billsService.getUpcomingBills('user-123');

            expect(result).toEqual(mockUpcomingBills);
            expect(result).toHaveLength(1);
            expect(result[0].payment_status).toBe('pending');
        });
    });

    describe('createBill', () => {
        it('should create a new bill', async () => {
            const billData = {
                cardId: 'card-123',
                userId: 'user-123',
                billMonth: 1,
                billYear: 2025,
                billAmount: 10000,
                billDate: new Date('2025-01-01'),
                dueDate: new Date('2025-01-20')
            };

            const mockCreatedBill = {
                id: 'bill-new',
                ...billData
            };

            (billsQueries.createBill as jest.Mock).mockResolvedValue(mockCreatedBill);

            const result = await billsService.createBill(billData);

            expect(result).toEqual(mockCreatedBill);
            expect(billsQueries.createBill).toHaveBeenCalledWith(billData);
        });
    });

    describe('deleteBill', () => {
        it('should delete a bill', async () => {
            (billsQueries.deleteBill as jest.Mock).mockResolvedValue(true);

            const result = await billsService.deleteBill('user-123', 'bill-123');

            expect(result).toBe(true);
            expect(billsQueries.deleteBill).toHaveBeenCalledWith('user-123', 'bill-123');
        });

        it('should return false if bill not found', async () => {
            (billsQueries.deleteBill as jest.Mock).mockResolvedValue(false);

            const result = await billsService.deleteBill('user-123', 'nonexistent');

            expect(result).toBe(false);
        });
    });
});
