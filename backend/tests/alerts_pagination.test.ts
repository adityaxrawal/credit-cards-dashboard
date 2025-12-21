import * as alertsQueries from '../src/db/queries/alerts.queries';
import pool from '../src/lib/db';

// Mock DB
jest.mock('../src/lib/db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

describe('Alerts Pagination', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return alerts with total count using window function', async () => {
        const mockRows = [
            { id: '1', title: 'Alert 1', total_count: '2' },
            { id: '2', title: 'Alert 2', total_count: '2' }
        ];

        (pool.query as jest.Mock).mockResolvedValue({
            rows: mockRows,
            rowCount: 2
        });

        const result = await alertsQueries.getUserAlerts(userId, { limit: 10, offset: 0 });

        expect(result.total).toBe(2);
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).not.toHaveProperty('total_count'); // Should be cleaned up
        expect(result.data[0].id).toBe('1');
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining('COUNT(*) OVER()'),
            expect.arrayContaining([userId, 10, 0])
        );
    });

    it('should handle empty alerts list', async () => {
        (pool.query as jest.Mock).mockResolvedValue({
            rows: [],
            rowCount: 0
        });

        const result = await alertsQueries.getUserAlerts(userId);

        expect(result.total).toBe(0);
        expect(result.data).toHaveLength(0);
    });
});
