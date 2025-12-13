
import * as gmailClient from '../lib/gmailClient';
import pool from '../lib/db';
import logger from '../utils/logger';

async function runDebug() {
    const userId = 'ac7ed61f-6647-4b20-a93e-f76d114f292c'; // Replace with valid user ID from your DB

    try {
        const { rows } = await pool.query('SELECT google_refresh_token FROM users WHERE id = $1', [userId]);
        if (!rows.length || !rows[0].google_refresh_token) {
            console.error('User not found or no token');
            process.exit(1);
        }
        const token = rows[0].google_refresh_token;

        console.log('Listing messages...');
        const list = await gmailClient.listMessages(token, 'after:2023/01/01', 50);
        const ids = list.messages.map(m => m.id);
        console.log(`Found ${ids.length} messages. Fetching content...`);

        const start = Date.now();
        const results = await gmailClient.batchGetMessages(token, ids, 50);
        console.log(`Fetched ${results.length} messages in ${(Date.now() - start) / 1000}s`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
}

runDebug();
