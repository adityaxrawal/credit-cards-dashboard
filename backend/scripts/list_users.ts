import pool from '../src/lib/db';
import logger from '../src/utils/logger';

async function listUsers() {
    try {
        const res = await pool.query('SELECT id, email, google_refresh_token FROM users LIMIT 5');
        console.log('Users found:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listUsers();
