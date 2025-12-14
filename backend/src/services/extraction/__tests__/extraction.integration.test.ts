import request from 'supertest';
import app from '../../../app';
import pool from '../../../lib/db';

// Mock DB
jest.mock('../../../lib/db', () => ({
    query: jest.fn(),
    connect: jest.fn().mockReturnValue({
        query: jest.fn(),
        release: jest.fn(),
    })
}));

// Mock Authenticate Middleware to bypass auth
jest.mock('../../../middleware/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id' };
        next();
    }
}));

describe('Extraction API Integration', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/extraction/process-csv', () => {
        it('should process CSV rows and route to transactions/queue', async () => {
            const csvRows = [
                {
                    subject: 'Transaction Alert',
                    sender: 'alerts@hdfcbank.net',
                    snippet: 'Rs 100.00 spent on Credit Card ending 1234 at SWIGGY',
                    message_id: 'msg1',
                    internal_date: Date.now().toString()
                },
                {
                    subject: 'Offer',
                    sender: 'alerts@hdfcbank.net',
                    snippet: 'Get a loan today',
                    message_id: 'msg2', // Should terminate
                    internal_date: Date.now().toString()
                }
            ];

            // Mock DB: Get Cards (for default card)
            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ id: 'card-uuid', card_number_last4: '1234' }]
            });
            // Mock DB: Insert Bulk (assume success)
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
            // Mock DB: Log (assume success)
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/extraction/process-csv')
                .send({ csvRows });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.saved).toBe(1); // Msg1
            expect(res.body.terminated).toBe(1); // Msg2 (Loan)
            expect(res.body.stats.total).toBe(2);
        });

        it('should return 400 for invalid input', async () => {
            const res = await request(app)
                .post('/api/extraction/process-csv')
                .send({ csvRows: [] });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/extraction/review-queue', () => {
        it('should fetch pending items', async () => {
            const mockItems = [
                { id: '1', status: 'pending', transaction_data: {} }
            ];
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockItems });

            const res = await request(app)
                .get('/api/extraction/review-queue');

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM gpt_processing_queue'),
                expect.any(Array)
            );
        });
    });

    describe('POST /api/extraction/review/:id/approve', () => {
        it('should approve item and create transaction', async () => {
            // Mock Get Item (Found)
            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{
                    id: 'item1',
                    message_id: 'msg1',
                    transaction_data: {
                        amount: 500, merchant: 'UBER', date: '2023-01-01', cardLast4: '1234'
                    }
                }]
            });

            // Mock Get Cards (for linking)
            (pool.query as jest.Mock).mockResolvedValueOnce({
                rows: [{ id: 'card-uuid', card_number_last4: '1234' }]
            });

            // Mock Insert Transaction
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'txn1' }] });

            // Mock Update Queue
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/extraction/review/item1/approve')
                .send({ approved: true });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.transaction).toBeDefined();
        });

        it('should reject item', async () => {
            // Mock Get Item
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'item1' }] });
            // Mock Update Queue (Reject)
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/extraction/review/item1/approve')
                .send({ approved: false });

            expect(res.body.status).toBe('rejected');
        });
    });
});
