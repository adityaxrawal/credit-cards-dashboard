import pool from '../../lib/db';
import logger from '../../utils/logger';

/**
 * Setup and teardown for integration tests
 */

beforeAll(async () => {
    logger.info('[Integration Tests] Setting up test environment');

    // Verify database connection
    try {
        const result = await pool.query('SELECT NOW()');
        logger.info('[Integration Tests] Database connection OK', { time: result.rows[0].now });
    } catch (error) {
        logger.error('[Integration Tests] Database connection failed', error);
        throw error;
    }
});

afterAll(async () => {
    logger.info('[Integration Tests] Tearing down test environment');

    // Close database connections
    await pool.end();
});

// Global test helpers
export async function cleanupTestData(userId: string) {
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM bills WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM alerts WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_instruments WHERE user_id = $1', [userId]);
}
