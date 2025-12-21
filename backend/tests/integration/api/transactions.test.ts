import request from 'supertest';
import app from '../../../server';
import pool from '../../../lib/db';
import { cleanupTestData } from '../setup';

describe('Transactions API Integration Tests', () => {
    const testUserId = 'test-user-' + Date.now();
    let authToken: string;

    beforeAll(async () => {
        // Create test user and get auth token
        // Note: This assumes you have an auth endpoint. Adjust as needed.
        authToken = 'test-token'; // Mock for now
    });

    afterAll(async () => {
        await cleanupTestData(testUserId);
    });

    describe('GET /api/transactions', () => {
        test('should return empty array for new user', async () => {
            const response = await request(app)
                .get('/api/transactions')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('should require authentication', async () => {
            await request(app)
                .get('/api/transactions')
                .expect(401);
        });

        test('should support pagination', async () => {
            const response = await request(app)
                .get('/api/transactions?limit=10&offset=0')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('total');
        });

        test('should support filtering by date range', async () => {
            const from = '2024-01-01';
            const to = '2024-12-31';

            const response = await request(app)
                .get(`/api/transactions?from=${from}&to=${to}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('data');
        });
    });

    describe('POST /api/transactions', () => {
        test('should create a manual transaction', async () => {
            const transaction = {
                amount: 100.50,
                merchant: 'Test Merchant',
                category: 'Food',
                transactionDate: new Date().toISOString(),
                transactionType: 'credit_card_spend'
            };

            const response = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(transaction)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.amount).toBe(transaction.amount);
            expect(response.body.merchant).toBe(transaction.merchant);
        });

        test('should validate required fields', async () => {
            const invalidTransaction = {
                merchant: 'Test Merchant'
                // Missing required fields
            };

            await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidTransaction)
                .expect(400);
        });
    });

    describe('PUT /api/transactions/:id', () => {
        test('should update transaction category', async () => {
            // First create a transaction
            const createResponse = await request(app)
                .post('/api/transactions')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    amount: 50,
                    merchant: 'Test',
                    category: 'Others',
                    transactionDate: new Date().toISOString(),
                    transactionType: 'credit_card_spend'
                });

            const transactionId = createResponse.body.id;

            // Then update it
            const updateResponse = await request(app)
                .put(`/api/transactions/${transactionId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ category: 'Food' })
                .expect(200);

            expect(updateResponse.body.category).toBe('Food');
        });
    });
});
