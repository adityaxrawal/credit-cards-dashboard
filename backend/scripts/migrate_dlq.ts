import { Client } from 'pg';
import { env } from '../src/config/env';

const migrateDLQ = async () => {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        console.log('Adding dlq_reason and is_dead_letter to processing_retry_queue...');

        await client.query(`
            ALTER TABLE processing_retry_queue 
            ADD COLUMN IF NOT EXISTS dlq_reason TEXT,
            ADD COLUMN IF NOT EXISTS is_dead_letter BOOLEAN DEFAULT false;
        `);

        console.log('Migration executed successfully');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
};

migrateDLQ();
