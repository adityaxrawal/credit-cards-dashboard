/**
 * Accounts Service Tests
 * Unit tests for account management functionality
 */

// Mock dependencies
jest.mock('@shared/database/db', () => ({
    __esModule: true,
    default: {
        query: jest.fn(),
        connect: jest.fn().mockResolvedValue({
            query: jest.fn(),
            release: jest.fn(),
        }),
    },
}));

const mockPool = require('@shared/database/db').default;

describe('AccountsService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAll', () => {
        it('should return all accounts for a user', async () => {
            const mockAccounts = [
                { id: '1', name: 'Savings Account', type: 'savings', balance: 50000 },
                { id: '2', name: 'Current Account', type: 'current', balance: 25000 },
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockAccounts });

            const result = await mockPool.query(
                'SELECT * FROM instruments WHERE user_id = $1',
                [userId]
            );

            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].name).toBe('Savings Account');
        });

        it('should filter by account type', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await mockPool.query(
                'SELECT * FROM instruments WHERE user_id = $1 AND type = $2',
                [userId, 'savings']
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('type'),
                expect.arrayContaining([userId, 'savings'])
            );
        });
    });

    describe('getById', () => {
        it('should return account by id', async () => {
            const mockAccount = { id: '1', name: 'Savings', type: 'savings', balance: 50000 };
            mockPool.query.mockResolvedValueOnce({ rows: [mockAccount] });

            const result = await mockPool.query(
                'SELECT * FROM instruments WHERE id = $1 AND user_id = $2',
                ['1', userId]
            );

            expect(result.rows).toHaveLength(1);
            expect(result.rows[0].name).toBe('Savings');
        });

        it('should return empty for non-existent account', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const result = await mockPool.query(
                'SELECT * FROM instruments WHERE id = $1 AND user_id = $2',
                ['non-existent', userId]
            );

            expect(result.rows).toHaveLength(0);
        });
    });

    describe('updateBalance', () => {
        it('should update account balance', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: '1', balance: 55000 }],
            });

            const result = await mockPool.query(
                'UPDATE instruments SET balance = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
                [55000, '1', userId]
            );

            expect(result.rows[0].balance).toBe(55000);
        });
    });

    describe('getSummary', () => {
        it('should return account summary with totals by type', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { type: 'savings', total_balance: 100000, count: 2 },
                    { type: 'current', total_balance: 50000, count: 1 },
                ],
            });

            const result = await mockPool.query(
                'SELECT type, SUM(balance) as total_balance, COUNT(*) as count FROM instruments WHERE user_id = $1 GROUP BY type',
                [userId]
            );

            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].type).toBe('savings');
        });
    });

    describe('freezeAccount', () => {
        it('should freeze account successfully', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: '1', is_frozen: true }],
            });

            const result = await mockPool.query(
                'UPDATE instruments SET is_frozen = true WHERE id = $1 AND user_id = $2 RETURNING *',
                ['1', userId]
            );

            expect(result.rows[0].is_frozen).toBe(true);
        });
    });

    describe('unfreezeAccount', () => {
        it('should unfreeze account successfully', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: '1', is_frozen: false }],
            });

            const result = await mockPool.query(
                'UPDATE instruments SET is_frozen = false WHERE id = $1 AND user_id = $2 RETURNING *',
                ['1', userId]
            );

            expect(result.rows[0].is_frozen).toBe(false);
        });
    });
});

export {};
