/**
 * API Integration Tests
 * Tests full API endpoints with supertest
 */

import request from 'supertest';
import app from '../../app';

// Mock authentication
jest.mock('../../middleware/auth.middleware', () => ({
    authenticate: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-123', email: 'test@example.com' };
        next();
    },
}));

// Mock database
jest.mock('../../lib/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
}));

describe('API Integration Tests', () => {
    describe('Health Check', () => {
        it('GET /health should return 200', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('Auth Routes', () => {
        it('POST /api/auth/google should require authorization code', async () => {
            const response = await request(app)
                .post('/api/auth/google')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'Missing authorization code');
        });

        it('POST /api/auth/refresh should require refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect(response.status).toBe(400);
        });

        it('POST /api/auth/logout should succeed', async () => {
            const response = await request(app)
                .post('/api/auth/logout')
                .send({});

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Logged out successfully');
        });
    });

    describe('Cards Routes', () => {
        it('GET /api/cards should return cards array', async () => {
            const response = await request(app).get('/api/cards');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('POST /api/cards should require all fields', async () => {
            const response = await request(app)
                .post('/api/cards')
                .send({ cardName: 'Test Card' }); // Missing required fields

            expect(response.status).toBe(400);
        });
    });

    describe('Transactions Routes', () => {
        it('GET /api/transactions should return transactions', async () => {
            const response = await request(app).get('/api/transactions');

            expect(response.status).toBe(200);
        });

        it('POST /api/transactions should require all fields', async () => {
            const response = await request(app)
                .post('/api/transactions')
                .send({ merchant: 'Amazon' }); // Missing required fields

            expect(response.status).toBe(400);
        });
    });

    describe('Rate Limiting', () => {
        it('should include rate limit headers', async () => {
            const response = await request(app).get('/api/cards');

            // Rate limit headers should be present
            expect(response.headers).toHaveProperty('ratelimit-limit');
            expect(response.headers).toHaveProperty('ratelimit-remaining');
        });
    });
});
