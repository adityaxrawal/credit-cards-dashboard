/**
 * TransactionDeduplicator Tests
 * Tests for fingerprint generation, duplicate detection, and near-duplicate matching
 */

import { TransactionDeduplicator } from '@modules/transactions/services/TransactionDeduplicator';

// Mock dependencies
jest.mock('@shared/database/db', () => ({
    __esModule: true,
    default: {
        query: jest.fn(),
    },
}));

jest.mock('@shared/utils/infrastructure/logger', () => ({
    __esModule: true,
    default: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));

const mockPool = require('@shared/database/db').default;

describe('TransactionDeduplicator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateFingerprint', () => {
        it('should generate consistent fingerprints for same input', () => {
            const components = {
                amount: 1500.50,
                merchant: 'Amazon',
                date: new Date('2024-01-15'),
                cardLastFour: '1234',
            };

            const fp1 = TransactionDeduplicator.generateFingerprint(components);
            const fp2 = TransactionDeduplicator.generateFingerprint(components);

            expect(fp1).toBe(fp2);
            expect(fp1).toHaveLength(64); // SHA256 hex length
        });

        it('should generate different fingerprints for different amounts', () => {
            const base = {
                merchant: 'Amazon',
                date: new Date('2024-01-15'),
                cardLastFour: '1234',
            };

            const fp1 = TransactionDeduplicator.generateFingerprint({ ...base, amount: 100 });
            const fp2 = TransactionDeduplicator.generateFingerprint({ ...base, amount: 100.01 });

            expect(fp1).not.toBe(fp2);
        });

        it('should normalize merchant names (case insensitive)', () => {
            const base = {
                amount: 500,
                date: new Date('2024-01-15'),
            };

            const fp1 = TransactionDeduplicator.generateFingerprint({ ...base, merchant: 'AMAZON' });
            const fp2 = TransactionDeduplicator.generateFingerprint({ ...base, merchant: 'amazon' });
            const fp3 = TransactionDeduplicator.generateFingerprint({ ...base, merchant: 'Amazon' });

            expect(fp1).toBe(fp2);
            expect(fp2).toBe(fp3);
        });

        it('should handle date as string or Date object', () => {
            const base = {
                amount: 500,
                merchant: 'Test Merchant',
            };

            const fp1 = TransactionDeduplicator.generateFingerprint({
                ...base,
                date: new Date('2024-01-15')
            });
            const fp2 = TransactionDeduplicator.generateFingerprint({
                ...base,
                date: '2024-01-15'
            });

            expect(fp1).toBe(fp2);
        });
    });

    describe('normalizeMerchant', () => {
        it('should convert to lowercase', () => {
            expect((TransactionDeduplicator as any).normalizeMerchant('AMAZON')).toBe('amazon');
        });

        it('should trim whitespace', () => {
            expect((TransactionDeduplicator as any).normalizeMerchant('  amazon  ')).toBe('amazon');
        });

        it('should remove common prefixes', () => {
            const result = (TransactionDeduplicator as any).normalizeMerchant('GOOGLE*YOUTUBE');
            expect(result).not.toContain('*');
        });

        it('should handle empty string', () => {
            expect((TransactionDeduplicator as any).normalizeMerchant('')).toBe('');
        });
    });

    describe('normalizeDate', () => {
        it('should convert Date to YYYY-MM-DD', () => {
            const result = (TransactionDeduplicator as any).normalizeDate(new Date('2024-03-15T10:30:00Z'));
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should handle string dates', () => {
            const result = (TransactionDeduplicator as any).normalizeDate('2024-03-15');
            expect(result).toBe('2024-03-15');
        });
    });

    describe('checkDuplicate', () => {
        it('should return isDuplicate=true when fingerprint exists', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'existing-tx-id', amount: 500 }],
            });

            const result = await TransactionDeduplicator.checkDuplicate(
                'user-123',
                'fingerprint-abc'
            );

            expect(result.isDuplicate).toBe(true);
            expect(result.existingTransactionId).toBe('existing-tx-id');
            expect(result.confidence).toBe(1);
        });

        it('should return isDuplicate=false when fingerprint not found', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const result = await TransactionDeduplicator.checkDuplicate(
                'user-123',
                'fingerprint-new'
            );

            expect(result.isDuplicate).toBe(false);
            expect(result.existingTransactionId).toBeUndefined();
        });
    });

    describe('checkNearDuplicate', () => {
        it('should detect near-duplicates with same amount and similar merchant', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'tx-1', merchant: 'amazon', amount: 500, transaction_date: new Date() },
                ],
            });

            const result = await TransactionDeduplicator.checkNearDuplicate(
                'user-123',
                {
                    amount: 500,
                    merchant: 'AMAZON.IN',
                    date: new Date(),
                }
            );

            expect(result.isNearDuplicate).toBe(true);
            expect(result.matchedIds).toContain('tx-1');
        });

        it('should not match with different amounts', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const result = await TransactionDeduplicator.checkNearDuplicate(
                'user-123',
                {
                    amount: 500,
                    merchant: 'Amazon',
                    date: new Date(),
                }
            );

            expect(result.isNearDuplicate).toBe(false);
        });
    });

    describe('merchantSimilarity', () => {
        it('should return 1 for identical merchants', () => {
            const similarity = (TransactionDeduplicator as any).merchantSimilarity('amazon', 'amazon');
            expect(similarity).toBe(1);
        });

        it('should return high similarity for minor differences', () => {
            const similarity = (TransactionDeduplicator as any).merchantSimilarity('amazon', 'amazn');
            expect(similarity).toBeGreaterThan(0.8);
        });

        it('should return low similarity for different merchants', () => {
            const similarity = (TransactionDeduplicator as any).merchantSimilarity('amazon', 'flipkart');
            expect(similarity).toBeLessThan(0.5);
        });
    });

    describe('levenshtein', () => {
        it('should return 0 for identical strings', () => {
            expect((TransactionDeduplicator as any).levenshtein('test', 'test')).toBe(0);
        });

        it('should return correct distance for single character difference', () => {
            expect((TransactionDeduplicator as any).levenshtein('test', 'tent')).toBe(1);
        });

        it('should return string length when other is empty', () => {
            expect((TransactionDeduplicator as any).levenshtein('test', '')).toBe(4);
        });
    });

    describe('getOrCreate', () => {
        it('should return existing transaction if fingerprint exists', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'existing-id' }],
            });

            const createFn = jest.fn();

            const result = await TransactionDeduplicator.getOrCreate(
                'user-123',
                'existing-fingerprint',
                createFn
            );

            expect(result.transactionId).toBe('existing-id');
            expect(result.isNew).toBe(false);
            expect(createFn).not.toHaveBeenCalled();
        });

        it('should call createFn and return new transaction if fingerprint not found', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const createFn = jest.fn().mockResolvedValue('new-tx-id');

            const result = await TransactionDeduplicator.getOrCreate(
                'user-123',
                'new-fingerprint',
                createFn
            );

            expect(result.transactionId).toBe('new-tx-id');
            expect(result.isNew).toBe(true);
            expect(createFn).toHaveBeenCalled();
        });
    });

    describe('findRefundMatch', () => {
        it('should find matching debit for refund', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'original-debit', merchant: 'amazon', amount: 500 },
                ],
            });

            const result = await TransactionDeduplicator.findRefundMatch(
                'user-123',
                500,
                'Amazon',
                new Date()
            );

            expect(result.originalTransactionId).toBe('original-debit');
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should return null when no match found', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [],
            });

            const result = await TransactionDeduplicator.findRefundMatch(
                'user-123',
                500,
                'Unknown Merchant',
                new Date()
            );

            expect(result.originalTransactionId).toBeNull();
        });
    });

    describe('linkTransactions', () => {
        it('should link transactions successfully', async () => {
            mockPool.query.mockResolvedValueOnce({
                rowCount: 1,
            });

            const result = await TransactionDeduplicator.linkTransactions(
                'tx-1',
                'tx-2',
                'refund'
            );

            expect(result).toBe(true);
            expect(mockPool.query).toHaveBeenCalled();
        });
    });

    describe('findDuplicateClusters', () => {
        it('should find clusters of potential duplicates', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { amount: 500, merchant: 'amazon', transaction_ids: ['tx-1', 'tx-2'], dates: [new Date(), new Date()] },
                ],
            });

            const clusters = await TransactionDeduplicator.findDuplicateClusters('user-123');

            expect(clusters).toHaveLength(1);
            expect(clusters[0].transactionIds).toContain('tx-1');
        });
    });
});
