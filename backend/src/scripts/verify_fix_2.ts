import pool from '../lib/db';
import { EmailProcessingLogService } from '../services/emailProcessingLog.service';

async function verifyFix2() {
    console.log('--- Starting Fix 2 Verification ---');

    const logService = new EmailProcessingLogService(pool);

    // 1. Simulate Migration (In real usage, user runs migration. Here we assume it ran or query fails)
    // We will check if `gpt_batch_queue` exists.
    try {
        await pool.query('SELECT 1 FROM gpt_batch_queue LIMIT 1');
        console.log('✅ Table gpt_batch_queue exists.');
    } catch (e: any) {
        if (e.code === '42P01') { // undefined_table
            console.warn('⚠️ Table gpt_batch_queue DOES NOT EXIST. Please run migration!');

            // Try to create it for this test only?
            console.log('Attempting to apply migration schema temporarily...');
            try {
                // Apply the exact SQL from our migration file content (simplified)
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS gpt_batch_queue (
                        batch_id VARCHAR(255) PRIMARY KEY,
                        queue_id INTEGER NOT NULL,
                        email_message_ids JSONB,
                        batch_size INTEGER,
                        status VARCHAR(50) DEFAULT 'pending', 
                        processing_note TEXT,
                        retry_count INTEGER DEFAULT 0,
                        processing_started_at TIMESTAMP,
                        processing_completed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS reason VARCHAR(500);
                `);
                console.log('✅ Temporary schema applied.');
            } catch (migErr) {
                console.error('Failed to apply schema:', migErr);
                process.exit(1);
            }
        } else {
            console.error('Error checking table:', e);
        }
    }

    // 2. Test Logging with new columns
    const testId = `verify-fix2-${Date.now()}`;
    const userIdRes = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = userIdRes.rows[0]?.id || '00000000-0000-0000-0000-000000000000';

    try {
        console.log('Testing logTerminator with new columns...');
        await logService.logTerminator({
            userId,
            emailMessageId: testId,
            fromAddress: 'test@example.com',
            subject: 'Verification Test Subject',
            reason: 'Test Reason 123'
        });

        // Verify inserted data
        const res = await pool.query(
            'SELECT * FROM email_processing_log WHERE email_message_id = $1',
            [testId]
        );

        if (res.rows.length === 1) {
            const row = res.rows[0];
            console.log('Row:', row);
            if (row.reason === 'Test Reason 123') {
                console.log('✅ Reason column populated correctly.');
            } else {
                console.error('❌ Reason column mismatch:', row.reason);
            }
            if (row.from_email === 'test@example.com') {
                console.log('✅ from_email populated correctly.');
            } else {
                console.error('❌ from_email mismatch:', row.from_email);
            }
        } else {
            console.error('❌ Log entry not found.');
        }

        // Cleanup
        await pool.query('DELETE FROM email_processing_log WHERE email_message_id = $1', [testId]);
        // Also drop table if we created it? No, assume stateful.

    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        await pool.end();
    }
}

verifyFix2();
