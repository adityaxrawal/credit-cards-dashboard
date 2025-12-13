import { Client } from 'pg';
import { env } from '../config/env';

async function verifyIndexes() {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        const indexesToCheck = [
            'idx_email_log_stats',
            'idx_transactions_user_amount',
            'idx_transactions_user_category',
            'idx_gmail_sync_jobs_user_started'
        ];

        console.log('Verifying indexes...');

        for (const idx of indexesToCheck) {
            const res = await client.query(
                `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
                [idx]
            );

            if (res.rows.length > 0) {
                console.log(`✅ Index found: ${idx}`);
            } else {
                console.error(`❌ Index MISSING: ${idx}`);
                process.exit(1);
            }
        }

        console.log('All optimization indexes verified.');

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

verifyIndexes();
