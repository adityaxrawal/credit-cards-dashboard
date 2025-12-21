import { listTransactions } from '../src/db/queries/transactions.queries';
import pool from '../src/lib/db';

// Mock DB
jest.mock('../src/lib/db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

describe('Pagination Pattern', () => {
    const userId = 'user-1';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should list transactions and extract total count correctly', async () => {
        const mockRows = [
            { id: '1', amount: 100, total_count: '5' },
            { id: '2', amount: 200, total_count: '5' }
        ];

        (pool.query as jest.Mock).mockResolvedValue({ rows: mockRows });

        const result = await listTransactions(userId, { limit: 10, offset: 0 });

        expect(result.total).toBe(5);
        expect(result.data.length).toBe(2);
        // Ensure total_count is removed from data objects
        expect((result.data[0] as any).total_count).toBeUndefined();
        expect(pool.query).toHaveBeenCalledTimes(1); // Should only be 1 query now
    });

    it('should handle empty results', async () => {
        (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

        const result = await listTransactions(userId, { limit: 10 });

        expect(result.total).toBe(0);
        expect(result.data.length).toBe(0);
    });
});
