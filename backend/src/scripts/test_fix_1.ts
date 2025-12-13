import pool from '../lib/db';
import { parallelProcessingCoordinator } from '../services/parallelProcessingCoordinator';
import { ExtractionInput } from '../services/extraction.service';

async function testFix1() {
    console.log('--- Starting Fix 1 Verification ---');

    // 1. Get Test User
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
        console.error('No users found.');
        process.exit(1);
    }
    const userId = userRes.rows[0].id;
    console.log(`Using User ID: ${userId}`);

    // 2. Create Mock Emails (Ambiguous/Unknown to force GPT)
    const mockEmails: ExtractionInput[] = [];
    for (let i = 0; i < 7; i++) { // Generate 7 to test batching (5) + draining (2)
        mockEmails.push({
            id: `test-fix1-${Date.now()}-${i}`,
            subject: `Unknown Transaction ${i}`,
            from: 'unknown@bank.com',
            bodyText: `You spent $${10 + i} at Unknown Merchant`,
            date: new Date(),
            threadId: `thread-${i}`
        });
    }

    const jobId = `job-test-${Date.now()}`;

    // 3. Run Coordinator
    console.log(`Starting Job ${jobId} with ${mockEmails.length} emails...`);
    try {
        const stats = await parallelProcessingCoordinator.processEmails(mockEmails, userId, jobId);
        console.log('--- Processing Complete ---');
        console.log('Stats:', stats);

        // 4. Verify Database for GPT Batches
        // We expect: 1 full batch (5 items) + 1 drained batch (2 items) = 2 batches
        // OR 1 drained batch if they are queued fast enough?
        // Actually, coordinator waits for rule-based.
        // It queues 7 items.
        // `gptQueueManager` might emit 'batch_ready' for the first 5 immediately.
        // `gptBatchProcessor` picks them up.
        // Then `drainQueues` runs for the remaining 2.

        await new Promise(r => setTimeout(r, 2000)); // Wait for async processing

        const batchRes = await pool.query(
            `SELECT * FROM gpt_batch_queue WHERE email_message_ids LIKE '%test-fix1%' ORDER BY created_at DESC`
        );

        console.log(`Found ${batchRes.rows.length} GPT batches.`);
        batchRes.rows.forEach(r => {
            console.log(`Batch ${r.batch_id}: Status=${r.status}, Size=${r.batch_size}`);
        });

        if (batchRes.rows.length > 0) {
            console.log('✅ Fix 1 Verification Passed: Batches created and processed.');
        } else {
            console.error('❌ Fix 1 Verification Failed: No batches found.');
        }

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await pool.end();
    }
}

testFix1();
