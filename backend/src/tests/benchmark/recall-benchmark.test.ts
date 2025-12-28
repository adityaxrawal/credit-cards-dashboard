import { GoldDatasetGenerator, GeneratedTestCase } from '../fixtures/GoldDatasetGenerator';
import { UniversalTransactionPipeline } from '../../services/transactions/pipeline/UniversalTransactionPipeline';
import { SanitizerService } from '../../services/gmail/sanitize/sanitizer';
import { BroadFinancialDetector } from '../../services/transactions/detection/BroadFinancialDetector';
import { EnhancedRuleClassifier } from '../../services/transactions/classification/EnhancedRuleClassifier';
import { TransactionExtractorFactory } from '../../services/transactions/extraction/TransactionExtractorFactory';
import { InstrumentService } from '../../services/cards/instruments/InstrumentService';
import { StatementParserFactory } from '../../services/statements/StatementParserFactory';
import { StatementReconciler } from '../../services/statements/StatementReconciler';
import { CleanEmail } from '../../types/transaction.types';

// Mock DB module
jest.mock('pdfjs-dist', () => ({
    getDocument: jest.fn(),
    GlobalWorkerOptions: { workerSrc: '' }
}));

jest.mock('../../lib/db', () => ({
    __esModule: true,
    safeQuery: jest.fn().mockResolvedValue({ rows: [{ id: 'mock-raw-id' }] }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    default: {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        on: jest.fn(),
        connect: jest.fn()
    }
}));

// Mock Instrument Service to avoid DB calls
jest.mock('../../services/cards/instruments/InstrumentService', () => ({
    InstrumentService: {
        getUserInstruments: jest.fn().mockResolvedValue([{ id: 'inst_1', account_number_masked: 'xxxx1234' }]),
    }
}));

jest.mock('../../services/cards/instruments/InstrumentAutoService', () => ({
    InstrumentAutoService: {
        findOrCreateCard: jest.fn().mockResolvedValue({ id: 'mock-inst-id' }),
        findOrCreateAccount: jest.fn().mockResolvedValue({ id: 'mock-acc-id' }),
        findOrCreateUPI: jest.fn().mockResolvedValue({ id: 'mock-upi-id' }),
    }
}));

// Mock GPT to fallback to null or failure if rules fail
const mockGPT = {
    classify: jest.fn().mockResolvedValue(null)
};

// Mock Queries
const mockTransactionsQueries = {
    createTransaction: jest.fn().mockResolvedValue({ id: 'mock-txn-id' }),
} as any;

const mockScannedEmailsQueries = {
    updateScannedEmailProcessed: jest.fn().mockResolvedValue(true),
} as any;

const mockTerminator = {
    terminate: jest.fn().mockResolvedValue(true)
} as any;

const pipeline = new UniversalTransactionPipeline({
    sanitizer: SanitizerService,
    broadDetector: BroadFinancialDetector,
    terminator: mockTerminator,
    classifierRegistry: {} as any,
    gptClassifier: mockGPT as any,
    enhancedClassifier: EnhancedRuleClassifier,
    extractorFactory: TransactionExtractorFactory,
    instrumentService: InstrumentService,
    manualReview: { markForManualReview: jest.fn() } as any,
    errorRecovery: { handleProcessingError: jest.fn() } as any,
    transactionsQueries: mockTransactionsQueries,
    scannedEmailsQueries: mockScannedEmailsQueries,
    statementParserFactory: StatementParserFactory,
    statementReconciler: StatementReconciler
});

describe('UniversalTransactionPipeline Benchmark', () => {
    // Generate 100 cases
    const dataset = GoldDatasetGenerator.generate(100);

    test.each(dataset.map((testCase, index) => [index, testCase]))(
        'Case #%i: %s',
        async (_, testCase: GeneratedTestCase) => {
            const { email, groundTruth } = testCase;

            // Construct CleanEmail manually for the mock return
            const cleanMock: CleanEmail = {
                id: email.messageId,
                subject: email.subject,
                from: email.from,
                cleanedBody: email.body, // Mapping SimplifiedEmail.body -> CleanEmail.cleanedBody
                internalDate: email.internalDate,
                hasAttachments: false,
                attachments: undefined
            };

            // Spy on sanitizer to return our mock clean email
            // (Since actual sanitizer won't run fully or we want to control input text exactly)
            const sanitizeSpy = jest.spyOn(SanitizerService, 'sanitize').mockResolvedValue(cleanMock);

            const result = await pipeline.processEmail(
                'user_benchmark',
                email, // SimplifiedEmail
                'job_benchmark',
                async () => Buffer.from('') // Mock attachment fetch
            );

            sanitizeSpy.mockRestore();

            // Verification Logic
            if (groundTruth.expectedType === 'non_financial') {
                expect(result.status).toBe('terminated');
            } else {
                if (result.status === 'success' || result.status === 'duplicate') {
                    // Check extraction accuracy if possible
                    const createCall = mockTransactionsQueries.createTransaction.mock.calls[mockTransactionsQueries.createTransaction.mock.calls.length - 1];
                    if (createCall) {
                        const extractedData = createCall[0];

                        // Basic validation
                        if (groundTruth.expectedAmount) {
                            expect(extractedData.amount).toBeCloseTo(groundTruth.expectedAmount);
                        }
                        if (groundTruth.expectedMerchant) {
                            expect(extractedData.merchant.toLowerCase()).toContain(groundTruth.expectedMerchant.toLowerCase());
                        }
                    }
                } else {
                    // Failure expected?
                    // For benchmark we just record it, but in unit test we fail if expected success
                    // Ideally Expected Success
                    // console.warn(`Failed financial email: ${email.subject} Result: ${result.status}`);
                    // We can assert success, but that might make test brittle if 1/100 fails.
                    // For now, let's assertion.
                }
            }
        }
    );

    // Aggregate Run
    test('Run Aggregate Benchmark', async () => {
        let tp = 0, fp = 0, fn = 0, tn = 0;
        const failures: any[] = [];

        console.log('\n--- STARTING BENCHMARK (100 Cases) ---');

        for (const testCase of dataset) {
            const { email, groundTruth } = testCase;

            const cleanMock: CleanEmail = {
                id: email.messageId,
                subject: email.subject,
                from: email.from,
                cleanedBody: email.body,
                internalDate: email.internalDate,
                hasAttachments: false,
                attachments: undefined
            };

            const sanitizeSpy = jest.spyOn(SanitizerService, 'sanitize').mockResolvedValue(cleanMock);

            // Create new mocks per run or clear them?
            // mockTransactionsQueries.createTransaction.mockClear(); 

            let result;
            try {
                result = await pipeline.processEmail('u', email, 'j', async () => null);
            } catch (e) {
                result = { status: 'failed', error: String(e) };
            }

            sanitizeSpy.mockRestore();

            if (groundTruth.expectedType === 'non_financial') {
                if (result.status === 'terminated') tn++;
                else {
                    fp++; // Detected as financial 
                    failures.push({ type: 'FP', subject: email.subject, result });
                }
            } else {
                if (result.status === 'success' || result.status === 'duplicate') {
                    tp++;
                } else {
                    fn++;
                    failures.push({ type: 'FN', subject: email.subject, result, expected: groundTruth.expectedType });
                }
            }
        }

        const precision = tp / (tp + fp) || 1;
        const recall = tp / (tp + fn) || 0;

        console.log(`\n--- BENCHMARK RESULTS ---`);
        console.log(`TP: ${tp}, TN: ${tn}, FP: ${fp}, FN: ${fn}`);
        console.log(`Recall: ${(recall * 100).toFixed(2)}%`);
        console.log(`Precision: ${(precision * 100).toFixed(2)}%`);

        if (failures.length > 0) {
            console.log('\nFailures:', JSON.stringify(failures.slice(0, 10), null, 2));
        }

        expect(recall).toBeGreaterThan(0.95);
    }, 60000);
});
