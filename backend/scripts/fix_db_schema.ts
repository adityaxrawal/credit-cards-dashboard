
import pool from '../src/lib/db';

async function migrate() {
    console.log('Running migration: Add cleaned_text to gmail_scanned_emails');
    try {
        await pool.query(`
      ALTER TABLE gmail_scanned_emails 
      ADD COLUMN IF NOT EXISTS cleaned_text TEXT;
    `);
        console.log('✅ Migration successful');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
