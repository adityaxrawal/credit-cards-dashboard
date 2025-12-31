
import { ProcessingWorkerPool } from '../src/services/infrastructure/ProcessingWorkerPool';
import { DbWriteQueueManager } from '../src/services/infrastructure/DbWriteQueueManager';

// Mock DB Queue Manager to avoid real DB writes
const mockDbManager = {
    enqueue: (table: string, data: any) => {
        // fast no-op
        return 'mock-job-id';
    },
    getQueueDepths: () => ({ scanned_emails: 0, transactions: 0, terminations: 0, job_stats: 0, scanned_email_updates: 0 })
};

// Mock dependencies
const TOTAL_EMAILS = 1000;
const SIMULATED_LATENCY_MS = 500; // 500ms per email
const CONCURRENCY = 50;

async function runBenchmark() {
    console.log(`Starting Benchmark: ${TOTAL_EMAILS} emails, ${SIMULATED_LATENCY_MS}ms latency, ${CONCURRENCY} concurrency`);

    // Setup Worker Pool
    const stats = { success: 0, failed: 0 };
    const pool = new ProcessingWorkerPool<number, void>(
        { concurrency: CONCURRENCY, name: 'BenchmarkPool' },
        async (emailId) => {
            // Simulate processing latency
            await new Promise(resolve => setTimeout(resolve, SIMULATED_LATENCY_MS));
        },
        () => { }, // onSuccess
        (item, err) => { stats.failed++; } // onError
    );

    pool.start();

    const start = Date.now();

    // Push items
    const items = Array.from({ length: TOTAL_EMAILS }, (_, i) => i);
    pool.submitBatch(items);

    // Wait for drain
    await monitorProgress(pool, start);

    const duration = (Date.now() - start) / 1000;
    const rate = TOTAL_EMAILS / duration;

    console.log(`\nBenchmark Completed in ${duration.toFixed(2)}s`);
    console.log(`Throughput: ${rate.toFixed(2)} emails/sec`);
    console.log(`Target: 100 emails/sec`);

    if (rate >= 90) { // Allow slight margin
        console.log('✅ PASS: Throughput meets target');
    } else {
        console.log('❌ FAIL: Throughput below target');
    }

    process.exit(0);
}

async function monitorProgress(pool: ProcessingWorkerPool<any, any>, startTime: number) {
    while (pool.getQueueDepth() > 0 || pool.getStats().activeWorkers > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const stats = pool.getStats();
        const processed = TOTAL_EMAILS - (pool.getQueueDepth() + stats.activeWorkers);
        const rate = processed / elapsed;

        process.stdout.write(`\rProcessed: ${processed}/${TOTAL_EMAILS} | Active: ${stats.activeWorkers} | Rate: ~${rate.toFixed(1)}/sec`);
        await new Promise(r => setTimeout(r, 200));
    }
}

runBenchmark().catch(console.error);
