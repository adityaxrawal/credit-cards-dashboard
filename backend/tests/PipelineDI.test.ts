
import { UniversalTransactionPipeline, IPipelineDependencies } from '../src/services/pipeline/UniversalTransactionPipeline';
import { SimplifiedEmail, CleanEmail, TransactionType, ExtractedTransaction } from '../src/types/transaction.types';
import logger from '../src/utils/logger';

// Mock logger to avoid noise
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

// Mock pg pool since it is used directly in Stage 1
jest.mock('../src/lib/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [{ id: 'raw-email-id' }] })
}));

describe('UniversalTransactionPipeline (DI)', () => {
    let pipeline: UniversalTransactionPipeline;
    let mockDeps: jest.Mocked<IPipelineDependencies>;

    const mockJobId = 'job-123';
    const mockUserId = 'user-123';
    const mockFetchAttachment = jest.fn();

    const mockRawEmail: SimplifiedEmail = {
        messageId: 'msg-123',
        threadId: 'thread-123',
        internalDate: Date.now(),
        subject: 'Transaction Alert',
        from: 'bank@example.com',
        body: 'You spent $100',
        snippet: 'You spent $100'
    };

    const mockCleanEmail: CleanEmail = {
        ...mockRawEmail,
        id: mockRawEmail.messageId,
        cleanedBody: 'You spent $100 extracted',
        hasAttachments: false,
        attachments: []
    };

    beforeEach(() => {
        // Create mocks for all dependencies
        mockDeps = {
            sanitizer: {
                sanitize: jest.fn().mockResolvedValue(mockCleanEmail)
            } as any,
            broadDetector: {
                isFinancialEmail: jest.fn().mockReturnValue(true)
            } as any,
            terminator: {
                terminate: jest.fn().mockResolvedValue(undefined)
            } as any,
            classifierRegistry: {
                getClassifiers: jest.fn().mockReturnValue([])
            } as any,
            gptClassifier: {
                classify: jest.fn().mockResolvedValue({
                    type: 'credit_card_transaction' as TransactionType,
                    confidence: 0.9,
                    metadata: {}
                })
            } as any,
            enhancedClassifier: {
                classify: jest.fn().mockReturnValue(null)
            } as any,
            extractorFactory: {
                getExtractor: jest.fn().mockReturnValue({
                    extract: jest.fn().mockResolvedValue({
                        amount: 100,
                        currency: 'USD',
                        merchant: 'Test Merchant',
                        instrumentType: 'credit_card',
                        transactionDate: new Date(),
                        fingerprint: 'fp-123'
                    })
                })
            } as any,
            instrumentService: {
                getUserInstruments: jest.fn().mockResolvedValue([])
            } as any,
            manualReview: {
                markForManualReview: jest.fn().mockResolvedValue(undefined)
            } as any,
            errorRecovery: {
                handleProcessingError: jest.fn()
            } as any,
            transactionsQueries: {
                createTransaction: jest.fn().mockResolvedValue({ id: 'txn-123' })
            } as any,
            scannedEmailsQueries: {
                updateScannedEmailProcessed: jest.fn().mockResolvedValue(undefined)
            } as any
        };

        pipeline = new UniversalTransactionPipeline(mockDeps);
    });

    it('should process a standard transaction successfully', async () => {
        const result = await pipeline.processEmail(mockUserId, mockRawEmail, mockJobId, mockFetchAttachment);

        expect(result.status).toBe('success');
        expect(result.transactionId).toBe('txn-123');

        // Verify flow
        expect(mockDeps.sanitizer.sanitize).toHaveBeenCalled();
        expect(mockDeps.broadDetector.isFinancialEmail).toHaveBeenCalled();
        expect(mockDeps.transactionsQueries.createTransaction).toHaveBeenCalled();
        expect(mockDeps.scannedEmailsQueries.updateScannedEmailProcessed).toHaveBeenCalled();
    });

    it('should terminate if broad detection fails', async () => {
        (mockDeps.broadDetector.isFinancialEmail as jest.Mock).mockReturnValue(false);

        const result = await pipeline.processEmail(mockUserId, mockRawEmail, mockJobId, mockFetchAttachment);

        expect(result.status).toBe('terminated');
        expect(result.reason).toBe('non_financial');
        expect(mockDeps.terminator.terminate).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.stringContaining('broad filter'),
            expect.any(String),
            'NON_FINANCIAL',
            expect.any(String),
            expect.any(String)
        );
        // Should NOT classify or extract
        expect(mockDeps.gptClassifier.classify).not.toHaveBeenCalled();
    });

    it('should use EnhancedRuleClassifier if it returns high confidence', async () => {
        (mockDeps.enhancedClassifier.classify as jest.Mock).mockReturnValue({
            type: 'bill_payment',
            confidence: 0.95
        });

        const result = await pipeline.processEmail(mockUserId, mockRawEmail, mockJobId, mockFetchAttachment);

        expect(result.status).toBe('success');
        // Should rely on enhanced classifier, so GPT shouldn't be called
        expect(mockDeps.gptClassifier.classify).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Enhanced Rule Match'));
    });
});
