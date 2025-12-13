
import pool from '../lib/db';
import logger from '../utils/logger';

async function updateSchema() {
    const client = await pool.connect();
    try {
        logger.info('Starting Gatekeeper Schema Update...');

        // 1. Update email_processing_log
        logger.info('Updating email_processing_log table...');
        await client.query(`
      ALTER TABLE email_processing_log 
      ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS processed_by VARCHAR(50), 
      ADD COLUMN IF NOT EXISTS extracted_amount DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS extracted_merchant VARCHAR(255),
      ADD COLUMN IF NOT EXISTS processing_method VARCHAR(50);
    `);

        // 2. Update existing records in email_processing_log (Mapping old logic if any)
        // Assuming 'processed_by' maps to 'processing_method' as I used 'processing_method' in the service code but the prompt used 'processed_by' in SQL.
        // The prompt service code used a mix:
        // logSuccess -> INSERT INTO ... (..., processed_by, ...) VALUES (..., data.processingMethod, ...)
        // So 'processed_by' column holds 'rule_based' or 'gpt'.
        // In my service code, I used 'processing_method' in the INSERT statement parameter list but the SQL column was 'processed_by' in prompt snippet 3.1.
        // Wait, let's check my service code again.
        // In my generated service code:
        // INSERT INTO ... (..., processing_method, ...) VALUES (...)
        // I used `processing_method` as the column name in my service code.
        // The Prompt Action 3.1 snippet used `processed_by` in the SQL string but `processingMethod` in the data object.
        // "processed_by, confidence_score"
        // I should probably stick to one. I used `processing_method` in the column list in my service code implementation.
        // So I need to ensure the column is `processing_method`.
        // Let me check my service code again in memory or via view_file if unsure.
        // I'll check what I wrote in step 23.
        // I wrote: `processing_method = EXCLUDED.processing_method` and `ADD COLUMN IF NOT EXISTS processing_method`.
        // So I will make sure the schema has `processing_method`.

        // 3. Create Index
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_terminated 
      ON email_processing_log(user_id, processing_status, processed_at DESC) 
      WHERE processing_status = 'filter_terminated';
    `);

        // 4. Update gmail_sync_jobs (Task 1.3)
        logger.info('Updating gmail_sync_jobs table...');
        await client.query(`
      ALTER TABLE gmail_sync_jobs 
      ADD COLUMN IF NOT EXISTS rule_based_success INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rule_based_failure INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS queued_for_gpt INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS terminated_count INT DEFAULT 0;
    `);

        logger.info('Schema Update Complete.');

    } catch (error) {
        logger.error('Schema Update Failed:', error);
    } finally {
        client.release();
        process.exit();
    }
}

updateSchema();
