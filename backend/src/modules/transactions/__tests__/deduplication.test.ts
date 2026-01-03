
import { TransactionDeduplicator, FingerprintComponents } from '../services/TransactionDeduplicator';
import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';
import crypto from 'crypto';

// Mock TransactionRepository
jest.mock('@modules/transactions/repositories/TransactionRepository');

describe('TransactionDeduplicator', () => {
    const userId = 'user-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateFingerprint', () => {
        it('should generate consistent fingerprint regardless of extra whitespace', () => {
            const comp1: FingerprintComponents = {
                amount: 100.50,
                merchant: '  Amazon India  ',
                date: new Date('2023-01-01T10:00:00Z'),
                direction: 'debit',
                rrn: 'RRN123'
            };

            const comp2: FingerprintComponents = {
                amount: 100.50,
                merchant: 'amazon india',
                date: new Date('2023-01-01T10:00:00Z'),
                direction: 'debit',
                rrn: 'RRN123'
            };

            const fp1 = TransactionDeduplicator.generateFingerprint(comp1);
            const fp2 = TransactionDeduplicator.generateFingerprint(comp2);

            expect(fp1).toBe(fp2);
        });

        it('should include RRN in fingerprint', () => {
            const comp1: FingerprintComponents = {
                amount: 100,
                merchant: 'Test',
                date: new Date(),
                rrn: 'RRN1'
            };
            const comp2: FingerprintComponents = {
                amount: 100,
                merchant: 'Test',
                date: comp1.date,
                rrn: 'RRN2' // Different RRN
            };

            expect(TransactionDeduplicator.generateFingerprint(comp1)).not.toBe(
                TransactionDeduplicator.generateFingerprint(comp2)
            );
        });
    });

    describe('checkDuplicate', () => {
        it('should detect duplicate via Primary Reference (RRN)', async () => {
            const components: FingerprintComponents = {
                amount: 500,
                merchant: 'Uber',
                date: new Date(),
                rrn: 'UBER123'
            };

            // Mock repository to return a match on Reference
            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue({
                id: 'existing-txn-id',
                rrn: 'UBER123'
            });

            const result = await TransactionDeduplicator.checkDuplicate(
                userId,
                'some-fingerprint',
                components
            );

            expect(result.isDuplicate).toBe(true);
            expect(result.matchType).toBe('PRIMARY_REF');
            expect(result.existingTransactionId).toBe('existing-txn-id');
            expect(TransactionRepository.findByReference).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({ rrn: 'UBER123' })
            );
        });

        it('should fallback to Exact Fingerprint if Ref not found', async () => {
            const fingerprint = 'exact-hash-match';

            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findByFingerprint as jest.Mock).mockResolvedValue({
                id: 'found-by-hash'
            });

            const result = await TransactionDeduplicator.checkDuplicate(
                userId,
                fingerprint,
                { amount: 100, merchant: 'Test', date: new Date() }
            );

            expect(result.isDuplicate).toBe(true);
            expect(result.matchType).toBe('EXACT_FINGERPRINT');
            expect(result.existingTransactionId).toBe('found-by-hash');
        });

        it('should attempt Soft Match if no primary/exact match', async () => {
            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findByFingerprint as jest.Mock).mockResolvedValue(null);

            // Mock soft match candidate return (amount range)
            (TransactionRepository.findPotentialDuplicates as jest.Mock).mockResolvedValue([
                { id: 'soft-match-id', merchant: 'Amazon IN', amount: 100 }
            ]);

            const components: FingerprintComponents = {
                amount: 100,
                merchant: 'Amazon India', // Similar to 'Amazon IN'
                date: new Date()
            };

            const result = await TransactionDeduplicator.checkDuplicate(
                userId,
                'new-hash',
                components
            );

            expect(result.isDuplicate).toBe(true);
            expect(result.matchType).toBe('SOFT_MATCH'); // Should match due to high similarity
        });

        it('should detect duplicate with slight amount difference (Soft Match)', async () => {
            (TransactionRepository.findByReference as jest.Mock).mockResolvedValue(null);
            (TransactionRepository.findByFingerprint as jest.Mock).mockResolvedValue(null);

            // Mock return for findPotentialDuplicates with amount range
            (TransactionRepository.findPotentialDuplicates as jest.Mock).mockResolvedValue([
                { id: 'fuzzy-amount-id', merchant: 'Netflix', amount: 199.00 }
            ]);

            const components: FingerprintComponents = {
                amount: 199.01, // Slight difference
                merchant: 'Netflix',
                date: new Date()
            };

            const result = await TransactionDeduplicator.checkDuplicate(
                userId,
                'fuzzy-hash',
                components
            );

            expect(result.isDuplicate).toBe(true);
            expect(result.matchType).toBe('SOFT_MATCH');
            expect(TransactionRepository.findPotentialDuplicates).toHaveBeenCalledWith(
                userId,
                expect.closeTo(199.00, 5), // min
                expect.closeTo(199.02, 5), // max
                expect.any(Date),
                expect.any(Date)
            );
        });
    });
});
