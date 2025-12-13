
import pool from '../lib/db';
import logger from '../utils/logger';

async function migrate() {
    const client = await pool.connect();
    try {
        logger.info('Starting migration: 008_add_processing_status');
        await client.query('BEGIN');

        // 1. Add processing_status column
        await client.query(`
      ALTER TABLE email_processing_log 
      ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'rule_based_attempt';
    `);
        logger.info('Added processing_status column');

        // 2. Create index for performance
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_processing_log_status 
      ON email_processing_log(user_id, email_message_id, processing_status);
    `);
        logger.info('Created index idx_email_processing_log_status');

        // 3. Update existing records if needed (default handles it, but ensures consistency)
        // No specific data update needed as DEFAULT handles it.

        await client.query('COMMIT');
        logger.info('Migration 008 completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Migration 008 failed:', error);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
