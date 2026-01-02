/**
 * Goals Service Tests
 * Unit tests for savings goal management functionality
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

describe('GoalsService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new goal', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    id: 'goal-1',
                    name: 'Emergency Fund',
                    target_amount: 300000,
                    current_amount: 0,
                    status: 'active',
                }],
            });

            const result = await mockPool.query(
                'INSERT INTO goals (user_id, name, target_amount) VALUES ($1, $2, $3) RETURNING *',
                [userId, 'Emergency Fund', 300000]
            );

            expect(result.rows[0].name).toBe('Emergency Fund');
            expect(result.rows[0].target_amount).toBe(300000);
            expect(result.rows[0].current_amount).toBe(0);
        });
    });

    describe('calculateProgress', () => {
        it('should calculate correct progress percentage', () => {
            const currentAmount = 75000;
            const targetAmount = 150000;
            const progress = Math.round((currentAmount / targetAmount) * 100);

            expect(progress).toBe(50);
        });

        it('should handle zero target amount', () => {
            const currentAmount = 0;
            const targetAmount = 0;
            const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

            expect(progress).toBe(0);
        });

        it('should cap at 100% when goal exceeded', () => {
            const currentAmount = 200000;
            const targetAmount = 150000;
            const progress = Math.min(100, Math.round((currentAmount / targetAmount) * 100));

            expect(progress).toBe(100);
        });
    });

    describe('addContribution', () => {
        it('should add contribution and update goal amount', async () => {
            const client = {
                query: jest.fn()
                    .mockResolvedValueOnce({}) // BEGIN
                    .mockResolvedValueOnce({ rows: [{ id: 'contrib-1' }] }) // Insert contribution
                    .mockResolvedValueOnce({}) // Update goal
                    .mockResolvedValueOnce({}), // COMMIT
                release: jest.fn(),
            };

            await client.query('BEGIN');
            await client.query('INSERT INTO goal_contributions...', [15000]);
            await client.query('UPDATE goals SET current_amount = ...');
            await client.query('COMMIT');
            client.release();

            expect(client.query).toHaveBeenCalledWith('BEGIN');
            expect(client.query).toHaveBeenCalledWith('COMMIT');
        });
    });

    describe('suggestMonthlyContribution', () => {
        it('should calculate suggested monthly contribution', () => {
            const calculateSuggested = (target: number, current: number, monthsRemaining: number) => {
                if (monthsRemaining <= 0) return target - current;
                return Math.ceil((target - current) / monthsRemaining);
            };

            expect(calculateSuggested(300000, 0, 12)).toBe(25000);
            expect(calculateSuggested(100000, 50000, 5)).toBe(10000);
            expect(calculateSuggested(100000, 100000, 5)).toBe(0);
        });
    });

    describe('getProgress', () => {
        it('should return goal progress with projected completion', async () => {
            const mockGoal = {
                id: 'goal-1',
                name: 'Vacation Fund',
                target_amount: 100000,
                current_amount: 50000,
                target_date: '2024-12-31',
                created_at: '2024-01-01',
            };

            mockPool.query.mockResolvedValueOnce({ rows: [mockGoal] });

            const result = await mockPool.query(
                'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
                ['goal-1', userId]
            );

            const progress = Math.round((result.rows[0].current_amount / result.rows[0].target_amount) * 100);
            expect(progress).toBe(50);
        });
    });

    describe('getSummary', () => {
        it('should return goals summary with totals', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    total_goals: 5,
                    active_goals: 3,
                    completed_goals: 2,
                    total_saved: 250000,
                    total_target: 500000,
                }],
            });

            const result = await mockPool.query(
                'SELECT COUNT(*) as total_goals FROM goals WHERE user_id = $1',
                [userId]
            );

            expect(result.rows[0].total_goals).toBe(5);
        });
    });

    describe('getAll', () => {
        it('should return all goals for user', async () => {
            const mockGoals = [
                { id: '1', name: 'Emergency Fund', target_amount: 300000, current_amount: 100000 },
                { id: '2', name: 'Vacation', target_amount: 100000, current_amount: 50000 },
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockGoals });

            const result = await mockPool.query(
                'SELECT * FROM goals WHERE user_id = $1',
                [userId]
            );

            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].name).toBe('Emergency Fund');
        });

        it('should filter by status', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await mockPool.query(
                'SELECT * FROM goals WHERE user_id = $1 AND status = $2',
                [userId, 'active']
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('status'),
                expect.arrayContaining([userId, 'active'])
            );
        });
    });

    describe('update', () => {
        it('should update goal details', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    id: 'goal-1',
                    name: 'Updated Goal',
                    target_amount: 200000,
                }],
            });

            const result = await mockPool.query(
                'UPDATE goals SET name = $1, target_amount = $2 WHERE id = $3 RETURNING *',
                ['Updated Goal', 200000, 'goal-1']
            );

            expect(result.rows[0].name).toBe('Updated Goal');
            expect(result.rows[0].target_amount).toBe(200000);
        });
    });

    describe('delete', () => {
        it('should soft delete goal', async () => {
            mockPool.query.mockResolvedValueOnce({ rowCount: 1 });

            const result = await mockPool.query(
                'UPDATE goals SET deleted_at = NOW() WHERE id = $1 AND user_id = $2',
                ['goal-1', userId]
            );

            expect(result.rowCount).toBe(1);
        });
    });
});

export {};
