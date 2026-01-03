
import { TransactionPipelineService, PdfTransactionData } from '../services/TransactionPipelineService';
import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';
import crypto from 'crypto';

// Mock TransactionRepository
jest.mock('@modules/transactions/repositories/TransactionRepository');

describe('TransactionPipelineService - PDF Integration', () => {
    const userId = 'user-pdf-integration';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('insertFromPdf', () => {
        const pdfData: PdfTransactionData = {
            amount: 1500.00,
            date: '2023-05-20',
            merchant: 'AMAZON PAY IND',
            description: 'Order #123456',
            bankName: 'HDFC Bank',
            confidence: 0.95
        };

        it('should create new transaction if no duplicate found', async () => {
            // Setup Mocks
            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findByFingerprint as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findPotentialDuplicates as jest.Mock).mockResolvedValue([]);

            (TransactionRepository.create as jest.Mock).mockResolvedValue({
                id: 'new-pdf-txn-id',
                ...pdfData
            });

            const result = await TransactionPipelineService.insertFromPdf(userId, pdfData);

            expect(result.transactionId).toBe('new-pdf-txn-id');
            expect(result.isNew).toBe(true);
            expect(TransactionRepository.create).toHaveBeenCalledWith(expect.objectContaining({
                transactionType: 'pdf_statement',
                metadata: expect.objectContaining({ source: 'PDF_STATEMENT' })
            }));
        });

        it('should skip creation if Exact Fingerprint match found', async () => {
            // Mock Exact Fingerprint found
            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findByFingerprint as jest.Mock).mockResolvedValue({
                id: 'existing-txn-id'
            });

            const result = await TransactionPipelineService.insertFromPdf(userId, pdfData);

            expect(result.transactionId).toBe('existing-txn-id');
            expect(result.isNew).toBe(false);
            expect(TransactionRepository.create).not.toHaveBeenCalled();
        });

        it('should skip creation if Soft Match (Deduplication) found', async () => {
            // Mock Soft Match found via Deduplicator logic
            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findByFingerprint as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findPotentialDuplicates as jest.Mock).mockResolvedValue([
                {
                    id: 'soft-match-id',
                    merchant: 'AMAZON PAY', // Similar merchant
                    amount: 1500.00,
                    transaction_date: new Date('2023-05-20')
                }
            ]);

            const result = await TransactionPipelineService.insertFromPdf(userId, pdfData);

            expect(result.transactionId).toBe('soft-match-id');
            expect(result.isNew).toBe(false);
            // Should log but not create
            expect(TransactionRepository.create).not.toHaveBeenCalled();
        });
    });
});
