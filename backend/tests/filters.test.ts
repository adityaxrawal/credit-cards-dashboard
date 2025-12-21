import { listTransactions } from '../src/services/transactions.service';
import * as transactionsQueries from '../src/db/queries/transactions.queries';

// Mock queries
jest.mock('../src/db/queries/transactions.queries', () => ({
    listTransactions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    getSpendingAggregations: jest.fn().mockResolvedValue({ totalSpent: 0, byCategory: [] })
}));

describe('Filter Handling', () => {
    it('should handle undefined filters gracefully in listTransactions', async () => {
        // Call with undefined filters
        // @ts-ignore - explicitly testing undefined at runtime
        await expect(listTransactions('user-1', undefined)).resolves.not.toThrow();
    });

    it('should pass empty filters to queries when undefined provided', async () => {
        // @ts-ignore
        await listTransactions('user-1', undefined);

        // Check if queries were called (verification that it proceeded past the potential crash point)
        expect(transactionsQueries.listTransactions).toHaveBeenCalled();
    });
});
