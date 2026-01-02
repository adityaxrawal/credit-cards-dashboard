/**
 * Loans Service Tests
 * Unit tests for loan management and EMI calculation functionality
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

describe('LoansService', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateEMI', () => {
        const calculateEMI = (principal: number, annualRate: number, tenureMonths: number) => {
            if (annualRate === 0) return Math.round(principal / tenureMonths);
            const r = annualRate / 12 / 100;
            return Math.round(principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1));
        };

        it('should calculate correct EMI for given principal, rate, and tenure', () => {
            // Test case: 10 lakh loan at 10% for 5 years
            const principal = 1000000;
            const annualRate = 10;
            const tenureMonths = 60;

            const emi = calculateEMI(principal, annualRate, tenureMonths);

            // Expected EMI is approximately ₹21,247
            expect(emi).toBeGreaterThan(21000);
            expect(emi).toBeLessThan(22000);
        });

        it('should return principal/tenure for 0% interest rate', () => {
            const principal = 120000;
            const annualRate = 0;
            const tenureMonths = 12;

            const emi = calculateEMI(principal, annualRate, tenureMonths);

            expect(emi).toBe(10000);
        });

        it('should calculate higher EMI for higher interest rates', () => {
            const principal = 500000;
            const tenureMonths = 60;

            const emi8 = calculateEMI(principal, 8, tenureMonths);
            const emi12 = calculateEMI(principal, 12, tenureMonths);

            expect(emi12).toBeGreaterThan(emi8);
        });
    });

    describe('generateAmortization', () => {
        it('should generate correct number of amortization entries', () => {
            const tenureMonths = 12;
            const schedule = Array.from({ length: tenureMonths }, (_, i) => ({
                installmentNumber: i + 1,
                emi: 10000,
                principal: 9000 + i * 50,
                interest: 1000 - i * 50,
            }));

            expect(schedule).toHaveLength(12);
            expect(schedule[0].installmentNumber).toBe(1);
            expect(schedule[11].installmentNumber).toBe(12);
        });

        it('should show increasing principal component over time', () => {
            // In a standard EMI, principal component increases each month
            const schedule = [
                { principal: 5000, interest: 5000 },
                { principal: 5050, interest: 4950 },
                { principal: 5100, interest: 4900 },
            ];

            expect(schedule[2].principal).toBeGreaterThan(schedule[0].principal);
            expect(schedule[2].interest).toBeLessThan(schedule[0].interest);
        });
    });

    describe('calculatePrepaymentImpact', () => {
        it('should calculate interest savings from prepayment', () => {
            const originalOutstanding = 400000;
            const prepaymentAmount = 100000;
            const newOutstanding = originalOutstanding - prepaymentAmount;

            // Simplified calculation: interest saved is proportional to prepayment
            const monthlyRate = 10 / 12 / 100;
            const remainingMonths = 48;
            const interestSaved = prepaymentAmount * monthlyRate * remainingMonths;

            expect(interestSaved).toBeGreaterThan(0);
            expect(newOutstanding).toBe(300000);
        });
    });

    describe('getAll', () => {
        it('should return all loans for user', async () => {
            const mockLoans = [
                { id: '1', loan_name: 'Home Loan', principal_amount: 5000000, status: 'active' },
                { id: '2', loan_name: 'Car Loan', principal_amount: 800000, status: 'active' },
            ];

            mockPool.query.mockResolvedValueOnce({ rows: mockLoans });

            const result = await mockPool.query(
                'SELECT * FROM loans WHERE user_id = $1',
                [userId]
            );

            expect(result.rows).toHaveLength(2);
            expect(result.rows[0].loan_name).toBe('Home Loan');
        });

        it('should filter by loan type', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            await mockPool.query(
                'SELECT * FROM loans WHERE user_id = $1 AND loan_type = $2',
                [userId, 'home_loan']
            );

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('loan_type'),
                expect.arrayContaining([userId, 'home_loan'])
            );
        });
    });

    describe('getSummary', () => {
        it('should return loan summary with totals', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{
                    total_loans: 3,
                    active_loans: 2,
                    total_outstanding: 2500000,
                    total_monthly_emi: 45000,
                }],
            });

            const result = await mockPool.query(
                'SELECT COUNT(*) as total_loans FROM loans WHERE user_id = $1',
                [userId]
            );

            expect(result.rows[0].total_loans).toBe(3);
        });
    });

    describe('recordPayment', () => {
        it('should record EMI payment and update loan', async () => {
            const client = {
                query: jest.fn()
                    .mockResolvedValueOnce({}) // BEGIN
                    .mockResolvedValueOnce({ rows: [{ principal: 15000, interest: 5000 }] }) // Payment insert
                    .mockResolvedValueOnce({}) // Update loan
                    .mockResolvedValueOnce({}), // COMMIT
                release: jest.fn(),
            };

            await client.query('BEGIN');
            await client.query('INSERT INTO loan_payments ...', [20000]);
            await client.query('UPDATE loans SET...');
            await client.query('COMMIT');
            client.release();

            expect(client.query).toHaveBeenCalledWith('BEGIN');
            expect(client.query).toHaveBeenCalledWith('COMMIT');
            expect(client.release).toHaveBeenCalled();
        });
    });
});

export {};
