// Test script to verify SEQUENTIAL batch processing
// Simulates processing 5 emails one after another

import { OllamaService } from './src/services/ollama.service';

const testEmails = [
    {
        id: 'batch-001',
        subject: 'Swiggy Transaction',
        body: 'Rs. 250 spent at SWIGGY on 12-DEC-2025.'
    },
    {
        id: 'batch-002',
        subject: 'Uber Ride',
        body: 'Rs. 450 spent at UBER on 12-DEC-2025.'
    },
    {
        id: 'batch-003',
        subject: 'Amazon Order',
        body: 'Rs. 1299 spent at AMAZON on 12-DEC-2025.'
    },
    {
        id: 'batch-004',
        subject: 'Starbucks Coffee',
        body: 'Rs. 350 spent at STARBUCKS on 12-DEC-2025.'
    },
    {
        id: 'batch-005',
        subject: 'Netflix Subscription',
        body: 'Rs. 649 spent at NETFLIX on 12-DEC-2025.'
    }
];

async function runBatchTest() {
    console.log('\n========================================');
    console.log('🧪 Testing Sequential Batch Processing (5 Emails)');
    console.log('========================================\n');

    const batchStartTime = Date.now();
    let successCount = 0;

    for (let i = 0; i < testEmails.length; i++) {
        const email = testEmails[i];
        console.log(`\n📧 [${i + 1}/5] Processing ${email.id}: "${email.subject}"`);

        try {
            const start = Date.now();

            // Call Ollama Service
            const result = await OllamaService.classifyEmail(email.body, {
                messageId: email.id,
                subject: email.subject
            });

            const elapsed = Date.now() - start;

            if (result.isTransaction && !result.error) {
                console.log(`✅ Success in ${elapsed}ms: ${result.merchant} - ${result.amount}`);
                successCount++;
            } else {
                console.log(`❌ Failed in ${elapsed}ms: ${result.error || 'Unknown error'}`);
            }

        } catch (error: any) {
            console.error(`❌ Exception: ${error.message}`);
        }
    }

    const totalTime = Date.now() - batchStartTime;
    const avgTime = totalTime / testEmails.length;

    console.log('\n========================================');
    console.log('📊 Batch Test Results');
    console.log('========================================');
    console.log(`Total Time:     ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Average Time:   ${(avgTime / 1000).toFixed(2)}s per email`);
    console.log(`Success Rate:   ${successCount}/${testEmails.length} (${(successCount / testEmails.length) * 100}%)`);

    // Validation
    const isSequential = avgTime > 1000; // Rough check, parallel would be much faster overall
    console.log(`\nSequential Check: ${isSequential ? '✅ Likely Sequential' : '❓ Too Fast (Parallel?)'}`);

    if (successCount === 5) {
        console.log('\n🎉 BATCH TEST PASSED!');
        process.exit(0);
    } else {
        console.log('\n❌ BATCH TEST FAILED');
        process.exit(1);
    }
}

// Run test
runBatchTest();
