import { getAllCards } from '../src/services/cards.service';
import * as cardsQueries from '../src/db/queries/cards.queries';

// Mock DB queries
jest.mock('../src/db/queries/cards.queries', () => ({
    getUserCards: jest.fn(),
    getCardUtilization: jest.fn() // Should not be called
}));

// Mock utils
jest.mock('../src/utils/billingCycle', () => ({
    getCurrentBillingPeriod: jest.fn().mockReturnValue({ billDate: new Date(), dueDate: new Date() })
}));

jest.mock('../src/utils/cacheInvalidation', () => ({
    invalidateCardCache: jest.fn()
}));

describe('Performance Optimization: getAllCards', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return cards with utilization without making N+1 queries', async () => {
        const mockCards = [
            { id: 'c1', credit_limit: 1000, outstanding_balance: 500, bill_date: 1, due_date: 20 },
            { id: 'c2', credit_limit: 2000, outstanding_balance: 100, bill_date: 5, due_date: 25 }
        ];

        (cardsQueries.getUserCards as jest.Mock).mockResolvedValue(mockCards);

        const result = await getAllCards(userId);

        expect(result).toHaveLength(2);
        expect(result[0].currentBalance).toBe(500);
        expect(result[0].utilization).toBe(50); // 500/1000 * 100

        expect(result[1].currentBalance).toBe(100);
        expect(result[1].utilization).toBe(5); // 100/2000 * 100

        expect(cardsQueries.getUserCards).toHaveBeenCalledTimes(1);
        // Crucial check: getCardUtilization should NOT be called
        expect(cardsQueries.getCardUtilization).not.toHaveBeenCalled();
    });
});
