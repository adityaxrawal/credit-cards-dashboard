import { Client } from 'pg';
import { env } from '../config/env';

const runFix = async () => {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        console.log('Adding missing unique constraint...');

        // Create the unique index required by the ON CONFLICT clause
        await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_email_fingerprint 
      ON transactions(email_message_id, txn_fingerprint);
    `);

        console.log('Successfully added index: idx_transactions_email_fingerprint');

    } catch (err) {
        console.error('Fix failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

runFix();
