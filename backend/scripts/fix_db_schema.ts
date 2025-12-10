
import pool from '../src/lib/db';

async function migrate() {
    console.log('Starting migration...');
    try {
        await pool.query(`
            ALTER TABLE gmail_scanned_emails 
            ADD COLUMN IF NOT EXISTS ml_is_transaction BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS ml_category TEXT,
            ADD COLUMN IF NOT EXISTS ml_confidence DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS ml_merchant TEXT,
            ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS parse_evidence TEXT,
            ADD COLUMN IF NOT EXISTS scan_job_id TEXT;
        `);
        console.log('Migration successful: Columns added.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

migrate();
