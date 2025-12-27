
import { Client } from 'pg';
import { env } from '../src/config/env';

async function fixMissingColumns() {
    const client = new Client({
        connectionString: env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database checking for missing columns...');

        // 1. Check/Add gmail_account_index
        try {
            await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS gmail_account_index INTEGER DEFAULT 1;
      `);
            console.log('✅ Checked/Added gmail_account_index');
        } catch (e) {
            console.error('❌ Failed to add gmail_account_index', e);
        }

        // 2. Check/Add gmail_thread_id
        try {
            await client.query(`
        ALTER TABLE transactions 
        ADD COLUMN IF NOT EXISTS gmail_thread_id VARCHAR(255);
      `);
            console.log('✅ Checked/Added gmail_thread_id');
        } catch (e) {
            console.error('❌ Failed to add gmail_thread_id', e);
        }

        console.log('Schema patch completed.');

    } catch (err) {
        console.error('Scirpt failed:', err);
    } finally {
        await client.end();
    }
}

fixMissingColumns();
