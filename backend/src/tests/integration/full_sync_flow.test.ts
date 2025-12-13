import pool from '../../lib/db';
import { runHistoricalScan } from '../../jobs/historicalScanner';
import * as gmailClient from '../../lib/gmailClient';
import { encrypt } from '../../utils/encryption';
import { randomUUID } from 'crypto';
import { ruleBasedWorkerPool } from '../../services/ruleBasedWorkerPool';

// Mock Gmail Client
jest.mock('../../lib/gmailClient');
// Mock Worker Pool (avoid threads in Jest)
jest.mock('../../services/ruleBasedWorkerPool', () => ({
    ruleBasedWorkerPool: {
        processEmail: jest.fn(),
        on: jest.fn(),
        emit: jest.fn()
    }
}));

describe('Full Sync Flow Integration Test', () => {
    const testUserId = randomUUID();
    const testJobId = randomUUID();
    const mockEmailId = 'msg-12345';

    // Sample Transaction Email Content
    const mockEmailContent = {
        id: mockEmailId,
        threadId: 'thread-123',
        labelIds: ['INBOX'],
        snippet: 'You spent 50.00 at Amazon...',
        payload: {
            headers: [
                { name: 'From', value: 'transaction@amazon.com' },
                { name: 'Subject', value: 'Your Amazon.com order' },
                { name: 'Date', value: new Date().toISOString() }
            ],
            body: { size: 0, data: '' },
            parts: [
                {
                    mimeType: 'text/plain',
                    body: {
                        data: Buffer.from('You spent 50.00 at Amazon on debit card ending 1234.').toString('base64')
                    }
                }
            ]
        },
        internalDate: Date.now().toString()
    };

    beforeAll(async () => {
        try {
            // Create Test User
            await pool.query(
                `INSERT INTO users (id, google_id, email, name, google_refresh_token, created_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [testUserId, 'google-id-' + testUserId, `test-${testUserId}@example.com`, 'Test User', encrypt('fake-refresh-token')]
            );

            // Create Test Job
            await pool.query(
                `INSERT INTO gmail_sync_jobs (id, user_id, status, started_at)
                 VALUES ($1, $2, 'pending', NOW())`,
                [testJobId, testUserId]
            );
        } catch (e) {
            console.error('FAILED TO SEED TEST DATABASE:', e);
            throw e;
        }
    });

    afterAll(async () => {
        try {
            console.log('Cleaning up test data...');
            // Cleanup Data
            await pool.query('DELETE FROM gmail_sync_jobs WHERE user_id = $1', [testUserId]);
            await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUserId]);
            await pool.query('DELETE FROM email_processing_log WHERE user_id = $1', [testUserId]);
            await pool.query('DELETE FROM gmail_scanned_emails WHERE user_id = $1', [testUserId]);
            await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
            console.log('Cleanup complete.');
        } catch (e) {
            console.error('Cleanup failed:', e);
        } finally {
            console.log('Closing DB pool...');
            await pool.end();
            console.log('DB pool closed.');
        }
    });

    it('should successfully scan emails and create transactions', async () => {
        // Mock Gmail Response
        (gmailClient.listMessages as jest.Mock).mockResolvedValue({
            messages: [{ id: mockEmailId, threadId: 'thread-123' }],
            resultSizeEstimate: 1
        });

        (gmailClient.batchGetMessages as jest.Mock).mockResolvedValue([
            mockEmailContent
        ]);

        (gmailClient.parseMessage as jest.Mock).mockReturnValue({
            id: mockEmailId,
            threadId: 'thread-123',
            from: 'transaction@amazon.com',
            to: 'test@example.com',
            subject: 'Your Amazon.com order',
            bodyText: 'You spent 50.00 at Amazon on debit card ending 1234.',
            date: new Date()
        });

        // Mock Worker Success
        (ruleBasedWorkerPool.processEmail as jest.Mock).mockResolvedValue({
            status: 'success',
            result: {
                merchant: 'Amazon',
                amount: 50.00,
                date: new Date(),
                card: '1234'
            },
            workerId: 1
        });

        // Run Scanner
        await runHistoricalScan(testUserId, testJobId);

        // Verify Job Stats (Coordinator should have updated this)
        const jobRes = await pool.query('SELECT * FROM gmail_sync_jobs WHERE id = $1', [testJobId]);
        expect(jobRes.rows[0].current_step).toBe('PROCESSING');
        expect(jobRes.rows[0].rule_based_success).toBe(1);

        // Verify Scanned Email (Scanner Bulk Insert)
        const scanRes = await pool.query(
            'SELECT * FROM gmail_scanned_emails WHERE user_id = $1 AND message_id = $2',
            [testUserId, mockEmailId]
        );
        expect(scanRes.rows.length).toBe(1);
        expect(scanRes.rows[0].subject).toBe('Your Amazon.com order');

        // Note: We cannot verify 'transactions' or 'email_processing_log' here because 
        // the RuleBasedWorker (which creates them) is mocked.
        // To test those, we would need a separate integration test for ExtractionService.
    }, 30000); // 30s timeout
});
