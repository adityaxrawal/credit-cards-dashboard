
import pool from '../lib/db';
import { extractTransactionFromEmail } from '../services/extraction.service';
import { ExtractionInput } from '../services/extraction.service';
import logger from '../utils/logger';

async function verify() {
    const userId = 'test-user-id'; // Make sure this user exists or use a real one
    // We need a real user ID. Let's fetch one.
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
        console.error('No users found to test with.');
        process.exit(1);
    }
    const realUserId = userRes.rows[0].id;

    const testEmailId = `test-email-${Date.now()}`;

    // Mock Email
    const mockEmail: ExtractionInput = {
        id: testEmailId,
        subject: 'Transaction Alert: HDFC Bank Credit Card',
        from: 'alerts@hdfcbank.net',
        bodyText: 'Rs. 100.00 spent on HDFC Bank Credit Card ending 1234 at SWIGGY',
        date: new Date(),
        threadId: testEmailId
    };

    try {
        console.log('--- Test 1: First Extraction Attempt ---');
        const res1 = await extractTransactionFromEmail(realUserId, mockEmail);
        console.log('Result 1:', res1.status);

        if (res1.status !== 'success' && res1.status !== 'queued_for_gpt') {
            console.error('Test 1 Failed: Unexpected status', res1);
        } else {
            console.log('Test 1 Passed');
        }

        console.log('--- Test 2: Duplicate Extraction Attempt ---');
        const res2 = await extractTransactionFromEmail(realUserId, mockEmail);
        console.log('Result 2:', res2.status);

        if (res2.status === 'already_processed') {
            console.log('Test 2 Passed: Correctly identified as already processed');
        } else {
            console.error('Test 2 Failed: Should be already_processed', res2);
        }

        console.log('--- Test 3: DB Log Verification ---');
        const logRes = await pool.query('SELECT * FROM email_processing_log WHERE email_message_id = $1', [testEmailId]);
        if (logRes.rows.length === 1) {
            console.log('Test 3 Passed: Log entry exists and is unique');
            console.log('Status:', logRes.rows[0].processing_status);
        } else {
            console.error('Test 3 Failed: Log entry count is', logRes.rows.length);
        }

        // cleanup
        await pool.query('DELETE FROM email_processing_log WHERE email_message_id = $1', [testEmailId]);
        await pool.query('DELETE FROM transactions WHERE email_message_id = $1', [testEmailId]);

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await pool.end();
    }
}

verify();
