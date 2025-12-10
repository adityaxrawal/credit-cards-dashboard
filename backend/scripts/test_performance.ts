import { OllamaService } from '../src/services/ollama.service';

/**
 * Performance Test Script
 * 
 * Tests the ML pipeline throughput and latency.
 * Run with: npx ts-node scripts/test_performance.ts
 */

async function testPerformance() {
    console.log('='.repeat(60));
    console.log('ML Pipeline Performance Test');
    console.log('='.repeat(60));

    // Check Ollama health first
    console.log('\n1. Checking Ollama health...');
    const healthy = await OllamaService.healthCheck();
    if (!healthy) {
        console.error('❌ Ollama is not healthy. Please ensure Ollama is running with the correct model.');
        console.log('   Run: ollama pull deepseek-r1:8b');
        process.exit(1);
    }
    console.log('✅ Ollama is healthy');

    // Warmup
    console.log('\n2. Warming up model...');
    await OllamaService.warmup();
    console.log('✅ Model warmed up');

    // Generate test emails (mix of transaction and non-transaction)
    const testCases = [
        // Transaction emails
        'HDFC Bank Credit Card alert: Rs.500 spent at SWIGGY on card ending 1234 on 09-Dec-24 at 14:30. Avl limit: Rs.45000',
        'SBI Card XX5678 used for INR 2,450.00 at AMAZON PAY INDIA on 09-Dec-24 20:15:32. Available Limit: INR 47,550',
        'ICICI: Refund of Rs.1,200 to card 5678 from FLIPKART on 08-Dec-24',
        'Axis Bank: Rs.999 spent at NETFLIX.COM on card XX1234 on 10-Dec-24 03:30',
        'Kotak: Your card XX9012 used for Rs.3,500 at ZOMATO BANGALORE on 09-Dec-24',
        // Non-transaction emails
        'Your Axis Bank Credit Card statement for Nov 2024 is ready. Total: Rs.15,000. Download now.',
        'OTP for transaction: 456789. Valid 10 min. Do not share.',
        'Weekend Sale! Get 20% cashback on dining. T&C apply.',
        'Your credit limit has been increased to Rs.2,00,000. Enjoy!',
        'Transaction declined: Rs.5,000 at FLIPKART. Reason: Insufficient limit.',
    ];

    // Test batch sizes
    const batchSizes = [10, 25, 50];

    console.log('\n3. Running batch performance tests...\n');

    for (const batchSize of batchSizes) {
        // Create batch by repeating test cases
        const batch: string[] = [];
        while (batch.length < batchSize) {
            batch.push(...testCases.slice(0, Math.min(testCases.length, batchSize - batch.length)));
        }

        console.log(`Testing batch size: ${batchSize} emails`);
        const startTime = Date.now();

        try {
            const results = await OllamaService.classifyBatch(batch);
            const elapsed = Date.now() - startTime;
            const perEmail = elapsed / batchSize;
            const transactions = results.filter(r => r.isTransaction).length;

            console.log(`  ✅ Completed in ${elapsed}ms (${perEmail.toFixed(1)}ms/email)`);
            console.log(`     Transactions: ${transactions}/${batchSize}, Avg confidence: ${(results.reduce((s, r) => s + r.confidence, 0) / batchSize).toFixed(2)}`);
        } catch (error) {
            console.log(`  ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        console.log();
    }

    // Get metrics
    console.log('\n4. Performance Metrics:');
    const metrics = OllamaService.getMetrics();
    console.log('   Total calls:', metrics.totalCalls);
    console.log('   Avg latency:', metrics.avgLatencyMs, 'ms');
    console.log('   Avg batch size:', metrics.avgBatchSize);
    console.log('   Success rate:', metrics.successRate);
    console.log('   Errors:', metrics.errors);

    // Extrapolate for 3000 emails
    console.log('\n5. Projected Performance (3000 emails):');
    if (metrics.avgBatchSize > 0 && metrics.avgLatencyMs > 0) {
        const numBatches = Math.ceil(3000 / 50); // Assuming batch size of 50
        const projectedTime = numBatches * metrics.avgLatencyMs * 0.5; // Assume 50% overlap from pipelining
        console.log(`   Estimated time: ${(projectedTime / 1000).toFixed(1)}s`);
        console.log(`   Target: <15 seconds`);
        console.log(`   Status: ${projectedTime < 15000 ? '✅ LIKELY ACHIEVABLE' : '⚠️ MAY EXCEED TARGET'}`);
    } else {
        console.log('   Insufficient data for projection');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Test completed');
    console.log('='.repeat(60));
}

testPerformance()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Test failed:', error);
        process.exit(1);
    });
