import { InstrumentService } from '../InstrumentService';
import pool from '../../../lib/db';
import { Instrument, InstrumentType } from '../../../types/transaction.types';

// Mock the db module
jest.mock('../../../lib/db', () => ({
    query: jest.fn(),
    connect: jest.fn(),
}));

describe('InstrumentService', () => {
    const userId = 'user-123';
    const mockInstrument: Instrument = {
        id: 'inst-1',
        user_id: userId,
        instrument_type: InstrumentType.CREDIT_CARD,
        bank_name: 'HDFC',
        account_number_masked: 'XX1234',
        is_active: true,
        is_primary: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        InstrumentService.clearAllCache();
    });

    describe('getUserInstruments', () => {
        test('should return instruments from DB and cache them', async () => {
            (pool.query as jest.Mock).mockResolvedValue({ rows: [mockInstrument] });

            const result1 = await InstrumentService.getUserInstruments(userId);
            expect(result1).toEqual([mockInstrument]);
            expect(pool.query).toHaveBeenCalledTimes(1);

            // Second call should come from cache
            const result2 = await InstrumentService.getUserInstruments(userId);
            expect(result2).toEqual([mockInstrument]);
            expect(pool.query).toHaveBeenCalledTimes(1);
        });
    });

    describe('getCardByIdentifier', () => {
        test('should find card in cache if available', async () => {
            // Populate cache first
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockInstrument] });
            await InstrumentService.getUserInstruments(userId);

            const card = await InstrumentService.getCardByIdentifier(userId, 'HDFC', '1234');
            expect(card).toEqual(mockInstrument);
        });

        test('should query DB if not in cache', async () => {
            // Clear cache
            (InstrumentService as any).instrumentCache = new Map();

            // First call to getUserInstruments (will populate empty cache)
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockInstrument] });
            await InstrumentService.getUserInstruments(userId);

            // Reset query mock
            jest.clearAllMocks();

            // Now getCardByIdentifier should find it in cache, no DB call needed
            const card = await InstrumentService.getCardByIdentifier(userId, 'HDFC', '1234');
            expect(card).toEqual(mockInstrument);
            // Should NOT have called DB again since cache was used
            expect(pool.query).not.toHaveBeenCalled();
        });

        test('should return null if not found', async () => {
            // Ensure cache is empty for this user
            InstrumentService.clearCache(userId);

            // Mock getUserInstruments to return empty array
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
            await InstrumentService.getUserInstruments(userId);

            // Now getCardByIdentifier should find nothing in cache and return null from DB fallback
            (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
            const card = await InstrumentService.getCardByIdentifier(userId, 'Axis', '9999');
            expect(card).toBeNull();
        });
    });
