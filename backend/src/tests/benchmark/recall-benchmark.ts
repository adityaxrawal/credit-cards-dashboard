import { GoldDatasetGenerator, GeneratedTestCase } from '../fixtures/GoldDatasetGenerator';
import { UniversalTransactionPipeline, IPipelineDependencies } from '../../services/transactions/pipeline/UniversalTransactionPipeline';
import { PipelineResult, TransactionType } from '../../../types/transaction.types';
import logger from '../../../utils/infrastructure/logger';

// Mock Dependencies
// In a real integration test we might use a DI container with overrides.
// For this benchmark, we'll try to instantiate the Pipeline with mocked DB layers so we don't write to DB.
// But UniversalTransactionPipeline imports singletons and dependencies directly or via constructor.
// Let's create a minimal mocked version of dependencies.

const mockDep = (name: string) => ({
    terminate: async () => { },
    createTransaction: async () => ({ id: 'mock-txn-id' }),
    updateScannedEmailProcessed: async () => { },
    handleProcessingError: async () => ({ action: 'NONE' }),
    markForManualReview: async () => { },
    getUserInstruments: async () => [{ id: 'inst_123', account_number_masked: 'xxxx1234' }],
    classify: async () => ({ type: 'gpt_fallback', confidence: 0.9, metadata: {} }), // GPT Mock
    checkExclusions: () => ({ isExcluded: false }),
    // ... other methods as needed by the pipeline
} as any);

// We need to construct the pipeline with mocked dependencies. 
// Since UniversalTransactionPipeline expects specific classes, we might need to cast or use a testing subclass.
// However, the actual pipeline imports 'universalPipeline' instance. 
// We should construct a NEW instance with mocks.

// Import real classes for logic heavy parts
import { SanitizerService } from '../../services/gmail/sanitize/sanitizer';
import { BroadFinancialDetector } from '../../services/transactions/detection/BroadFinancialDetector';
import { EnhancedRuleClassifier } from '../../services/transactions/classification/EnhancedRuleClassifier';
import { TransactionExtractorFactory } from '../../services/transactions/extraction/TransactionExtractorFactory';
import { InstrumentService } from '../../cards/instruments/InstrumentService';
import { StatementParserFactory } from '../../services/statements/StatementParserFactory';
import { StatementReconciler } from '../../services/statements/StatementReconciler';

// Mock DB Queries
const mockTransactionsQueries = {
    createTransaction: async (data: any) => { return { id: 'mock-id' }; },
    updateTransaction: async () => { },
} as any;

const mockScannedEmailsQueries = {
    updateScannedEmailProcessed: async () => { },
} as any;

const mockTerminator = {
    terminate: async (uid: string, eid: string, reason: string) => {
        // console.log(`[MockTerminator] Terminated: ${reason}`); 
    }
} as any;

const mockGPT = {
    classify: async () => { return null; } // Return null to force rule based or failure
} as any;

const mockManualReview = {
    markForManualReview: async () => { }
} as any;

const mockErrorRecovery = {
    handleProcessingError: async () => ({ action: 'LOG_ONLY' })
} as any;


const pipeline = new UniversalTransactionPipeline({
    sanitizer: SanitizerService,
    broadDetector: BroadFinancialDetector,
    terminator: mockTerminator,
    classifierRegistry: {} as any, // Not used strictly if we rely on EnhancedRuleClassifier
    gptClassifier: mockGPT,
    enhancedClassifier: EnhancedRuleClassifier,
    extractorFactory: TransactionExtractorFactory,
    instrumentService: InstrumentService as any, // Might need mocking db calls inside 
    manualReview: mockManualReview,
    errorRecovery: mockErrorRecovery,
    transactionsQueries: mockTransactionsQueries,
    scannedEmailsQueries: mockScannedEmailsQueries,
    statementParserFactory: StatementParserFactory,
    statementReconciler: StatementReconciler
});

// We need to mock InstrumentService.getUserInstruments if it hits DB
InstrumentService.getUserInstruments = async () => [];

async function runBenchmark() {
    console.log('Generating Gold Dataset...');
    const cases = GoldDatasetGenerator.generate(100); // 100 samples

    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let trueNegatives = 0; // Correctly identified as non-financial

    console.log(`Running Pipeline on ${cases.length} cases...\n`);

    const startTime = Date.now();

    for (const testCase of cases) {
        const { email, groundTruth } = testCase;

        // We need to bypass processEmailInternal internal stages that assume DB persistence if possible
        // But processEmailInternal does save raw email to DB in Stage 1. 
        // We might need to mock safeQuery in 'lib/db'. 
        // Since we can't easily mock module import here without Jest or proxyquire, 
        // we might hit DB connection error if we run this directly with ts-node without DB.

        // Ideally we should run this as a Jest test.
        // Or we catch the DB error in Stage 1 and hope pipeline continues? 
        // Using Jest is safer.

        // Let's assume we run this via Jest.

        // If we can't run via Jest in this environment easily without setup, 
        // we will adapt this script to be a Jest test file.
    }
}
