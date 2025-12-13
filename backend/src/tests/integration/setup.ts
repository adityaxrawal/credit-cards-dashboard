import pool from '../../lib/db';

afterAll(async () => {
    // Close the database connection pool after all tests are done
    await pool.end();
});
