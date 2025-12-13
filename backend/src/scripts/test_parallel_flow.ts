
import pool from '../lib/db';
import { runHistoricalScan } from '../jobs/historicalScanner';
import { randomUUID } from 'crypto';

async function runtest() {
    const userId = 'ac7ed61f-6647-4b20-a93e-f76d114f292c'; // Valid user
    const jobId = randomUUID();

    console.log('Creating test job:', jobId);

    await pool.query(
        `INSERT INTO gmail_sync_jobs (id, user_id, status, current_step, last_update_at)
     VALUES ($1, $2, 'pending', 'STARTING', NOW())`,
        [jobId, userId]
    );

    console.log('Starting scan...');
    try {
        // Run for strictly 30 seconds then exit potentially, or just let it process a batch
        // historicalScanner fetches 200.
        await runHistoricalScan(userId, jobId);
    } catch (e) {
        console.error('Scan error:', e);
    } finally {
        process.exit(0);
    }
}

runtest();
