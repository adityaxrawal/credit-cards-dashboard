
import pool from '../src/lib/db';

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Running migration: Add parent_transaction_id to transactions');
        await client.query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS parent_transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE;
    `);
        console.log('Migration successful');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

migrate();
