// Test script to verify Ollama service with enhanced logging
import { OllamaService } from './src/services/ollama.service';

const testEmail = `
HDFC Bank
Transaction Alert
Dear Customer,
Rs. 500.00 has been spent at SWIGGY using your HDFC Bank Credit Card ending 1234 on 10-DEC-2025.
Available Credit Limit: Rs. 49500.00
For queries, call 18002586161
`;

async function testSingleEmail() {
    console.log('\n========================================');
    console.log('🧪 Testing Single Email Classification');
    console.log('========================================\n');

    try {
        const startTime = Date.now();

        console.log('📧 Test Email:', testEmail.substring(0, 100) + '...\n');

        const result = await OllamaService.classifyEmail(testEmail, {
            messageId: 'test-email-001',
            subject: 'HDFC Bank: Transaction Alert'
        });

        const elapsed = Date.now() - startTime;

        console.log('\n✅ Classification Result:');
        console.log(JSON.stringify(result, null, 2));
        console.log(`\n⏱️  Total Time: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);

        // Get metrics
        const metrics = OllamaService.getMetrics();
        console.log('\n📊 Ollama Metrics:');
        console.log(JSON.stringify(metrics, null, 2));

        // Verify success criteria
        console.log('\n✅ Validation Checks:');
        console.log(`  - isTransaction: ${result.isTransaction ? '✅' : '❌'}`);
        console.log(`  - merchant extracted: ${result.merchant ? '✅ ' + result.merchant : '❌'}`);
        console.log(`  - amount extracted: ${result.amount ? '✅ ' + result.amount : '❌'}`);
        console.log(`  - confidence: ${result.confidence ? '✅ ' + result.confidence : '❌'}`);
        console.log(`  - no error: ${!result.error ? '✅' : '❌ ' + result.error}`);
        console.log(`  - latency < 15s: ${elapsed < 15000 ? '✅' : '❌'} (${(elapsed / 1000).toFixed(2)}s)`);

        if (!result.error && result.isTransaction && elapsed < 15000) {
            console.log('\n🎉 TEST PASSED!\n');
            process.exit(0);
        } else {
            console.log('\n❌ TEST FAILED - See validation checks above\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ TEST ERROR:', error);
        process.exit(1);
    }
}

// Run test
testSingleEmail();
