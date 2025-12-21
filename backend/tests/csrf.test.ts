import request from 'supertest';
import app from '../src/app';

// Mock DB to prevent connection errors during app initialization in tests
jest.mock('../src/lib/db', () => ({
    query: jest.fn(),
    connect: jest.fn().mockReturnValue({
        query: jest.fn(),
        release: jest.fn()
    })
}));

describe('CSRF Protection', () => {
    let csrfToken: string;
    let cookies: string[];

    test('GET /api/csrf-token should return a token and set cookie', async () => {
        const res = await request(app).get('/api/csrf-token');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('csrfToken');
        expect(res.headers['set-cookie']).toBeDefined();

        csrfToken = res.body.csrfToken;
        const cookieHeader = res.headers['set-cookie'];
        cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader as string];
    });

    test('POST request without token should fail with 403', async () => {
        // Attempting a state-changing request (even to a non-existent endpoint, middleware should catch it)
        const res = await request(app)
            .post('/api/some-protected-route')
            .set('Cookie', cookies); // Send session cookie but no token in header/body

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('CSRF_ERROR');
    });

    test('POST request with valid token should pass CSRF check', async () => {
        // Note: We need a real endpoint to test passing. 
        // Since we don't want to actually trigger side effects or rely on specific routes,
        // we just check that we don't get 403 CSRF_ERROR. 
        // Getting 404 is fine, it means passed CSRF middleware.

        const res = await request(app)
            .post('/api/non-existent-endpoint-but-csrf-passed')
            .set('Cookie', cookies)
            .set('CSRF-Token', csrfToken);

        expect(res.status).not.toBe(403);
        // Likely 404 because route doesn't exist
        // If we get 401 (Auth failed) or 404 (Not Found), it means we passed the CSRF check (which throws 403)
        expect([401, 404]).toContain(res.status);
    });
});
