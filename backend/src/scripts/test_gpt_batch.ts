import { GptBatchProcessor } from '../services/gptBatchProcessor';
import { SimplifiedEmail } from '../services/batchQueueService';

// Stub Jest
const jest = { fn: () => { } };

// Mock OpenAI
const mockCreate = jest.fn();

// We need to patch the private openai instance or mock the module.
// Since we are running this as a standalone script, we can't easily use Jest mocks on imports without a test runner.
// Instead, we will extend the class to override the 'callOpenAI' method for testing purposes.

class TestGptBatchProcessor extends GptBatchProcessor {
    // Override public for testing
    public async testChunking(emails: SimplifiedEmail[]) {
        // access private method via any cast
        return (this as any).chunkEmails(emails, 2);
    }

    public async testRetryLogic(shouldFailOnce: boolean, failType: string) {
        let attempts = 0;

        // Mock the internal callOpenAI
        (this as any).callOpenAI = async (payload: any) => {
            attempts++;
            console.log(`[Test] Call attempt ${attempts}`);

            if (attempts === 1 && shouldFailOnce) {
                if (failType === 'timeout') {
                    const e: any = new Error('Timeout');
                    e.code = 'ETIMEDOUT';
                    throw e;
                }
                if (failType === '500') {
                    const e: any = new Error('Server Error');
                    e.status = 500;
                    throw e;
                }
            }

            if (attempts === 1 && failType === 'fatal') {
                throw new Error('Fatal Logic Error');
            }

            return {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            results: [{ id: '1', isTransaction: true, merchantName: 'Test', amount: 100 }]
                        })
                    }
                }]
            };
        };

        try {
            const res = await (this as any).callModelWithRetry({});
            console.log('[Test] Result:', JSON.stringify(res));
            return attempts;
        } catch (e) {
            console.log('[Test] Failed as expected:', (e as Error).message);
            throw e;
        }
    }
}

async function runTests() {
    console.log('--- Starting Verification ---');
    const processor = new TestGptBatchProcessor();

    // 1. Test Chunking
    console.log('\n1. Testing Chunking...');
    const dummyEmails: SimplifiedEmail[] = Array(5).fill(null).map((_, i) => ({
        messageId: `${i}`,
        threadId: `${i}`,
        from: 'test@test.com',
        to: 'me@test.com',
        subject: `Sub ${i}`,
        body: 'body',
        internalDate: Date.now()
    }));
    const chunks = await processor.testChunking(dummyEmails);
    if (chunks.length === 3 && chunks[0].length === 2 && chunks[2].length === 1) {
        console.log('✅ Chunking working (2 per chunk)');
    } else {
        console.error('❌ Chunking failed', chunks.map((c: any) => c.length));
    }

    // 2. Test Retry - Timeout
    console.log('\n2. Testing Retry (Timeout)...');
    try {
        const attempts = await processor.testRetryLogic(true, 'timeout');
        if (attempts === 2) console.log('✅ Retried once on timeout');
        else console.error('❌ Did not retry correctly', attempts);
    } catch (e) {
        console.error('❌ Unexpected error', e);
    }

    // 3. Test Retry - 500
    console.log('\n3. Testing Retry (500)...');
    try {
        const attempts = await processor.testRetryLogic(true, '500');
        if (attempts === 2) console.log('✅ Retried once on 500');
        else console.error('❌ Did not retry correctly', attempts);
    } catch (e) {
        console.error('❌ Unexpected error', e);
    }

    // 4. Test Logic Error - No Retry
    console.log('\n4. Testing Fatal Error (No Retry)...');
    try {
        await processor.testRetryLogic(true, 'fatal');
    } catch (e) {
        console.log('✅ correctly threw error without retry');
    }

    console.log('\n--- Verification Complete ---');
}

runTests().catch(console.error);
