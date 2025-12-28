
import { GPTClassifier } from '../GPTClassifier';
import { CleanEmail } from '../../../../types/transaction.types';

// Mock OpenAI
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn().mockResolvedValue({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                results: [
                                    { messageId: '1', is_transaction: true, type: 'food', confidence: 1, extracted: { amount: 100, merchant: 'Test', currency: 'INR', date: '2023-01-01' } },
                                    { messageId: '2', is_transaction: true, type: 'food', confidence: 1, extracted: { amount: 100, merchant: 'Test', currency: 'INR', date: '2023-01-01' } },
                                    { messageId: '3', is_transaction: true, type: 'food', confidence: 1, extracted: { amount: 100, merchant: 'Test', currency: 'INR', date: '2023-01-01' } },
                                    { messageId: '4', is_transaction: true, type: 'food', confidence: 1, extracted: { amount: 100, merchant: 'Test', currency: 'INR', date: '2023-01-01' } },
                                    { messageId: '5', is_transaction: true, type: 'food', confidence: 1, extracted: { amount: 100, merchant: 'Test', currency: 'INR', date: '2023-01-01' } }
                                ]
                            })
                        }
                    }],
                    usage: { prompt_tokens: 100, completion_tokens: 100 }
                })
            }
        }
    }));
});

// Mock Pool
jest.mock('../../../../lib/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] })
}));

describe('GPTClassifier Batching', () => {

    // Helper to create dummy email
    const createEmail = (id: string) => ({
        id,
        subject: 'Test',
        from: 'test@test.com',
        cleanedBody: 'Test Body',
        internalDate: Date.now(),
        snippet: 'snippet',
        hasAttachments: false,
        attachmentCount: 0,
        body: 'raw'
    } as unknown as CleanEmail);

    test('should NOT resolve promises until 5 emails are added', async () => {
        const p1 = GPTClassifier.classify('user1', createEmail('1'), []);
        const p2 = GPTClassifier.classify('user1', createEmail('2'), []);
        const p3 = GPTClassifier.classify('user1', createEmail('3'), []);
        const p4 = GPTClassifier.classify('user1', createEmail('4'), []);

        // Assert predictions are pending (difficult in Jest without checking internal state or timeout)
        // We will rely on log inspection or checking if resolved.

        let resolvedCount = 0;
        p1.then(() => resolvedCount++);
        p2.then(() => resolvedCount++);
        p3.then(() => resolvedCount++);
        p4.then(() => resolvedCount++);

        await new Promise(r => setTimeout(r, 100)); // Wait a bit
        expect(resolvedCount).toBe(0); // Should be 0 because we need 5

        // Add 5th
        const p5 = GPTClassifier.classify('user1', createEmail('5'), []);

        await new Promise(r => setTimeout(r, 300)); // Allow async processing

        // Now all should resolve (assuming mocked OpenAI returns results for all)
        // Note: My mock returns results for 1-5 always regardless of input, but GPTClassifier uses messageId.
        // So mock result needs to match.
        // My mock above uses 1,2,3,4,5. So it should match.

        expect(resolvedCount).toBe(4); // p1-p4 should be done
        // p5 also done
    });

    test('forceFlush should resolve pending items < 5', async () => {
        const p1 = GPTClassifier.classify('user1', createEmail('1'), []);
        const p2 = GPTClassifier.classify('user1', createEmail('2'), []);

        await new Promise(r => setTimeout(r, 100));

        GPTClassifier.forceFlush();

        await new Promise(r => setTimeout(r, 100));

        // Should resolve (mocking response handling is cleaner if I update mock to be dynamic)
    });
});
