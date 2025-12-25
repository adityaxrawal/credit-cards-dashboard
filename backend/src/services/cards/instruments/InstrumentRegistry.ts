import { UserInstrumentRepository } from '../../../repositories/UserInstrumentRepository';
import { UserInstrument, UUID } from '../../../types/instruments.types';
import logger from '../../../utils/infrastructure/logger';

export class InstrumentRegistry {
    private static userInstrumentCache: Map<string, UserInstrument[]> = new Map();

    // Get ALL instruments for user (across all types)
    static async getUserInstruments(userId: UUID): Promise<UserInstrument[]> {
        if (this.userInstrumentCache.has(userId)) {
            return this.userInstrumentCache.get(userId)!;
        }

        try {
            const instruments = await UserInstrumentRepository.findByUserId(userId);
            this.userInstrumentCache.set(userId, instruments);
            return instruments;
        } catch (error) {
            logger.error(`Failed to get instruments for user ${userId}`, error);
            throw error;
        }
    }

    // Get instrument by type + ID
    static async getInstrument(userId: UUID, instrumentId: UUID, type: string): Promise<UserInstrument | null> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.find(i => i.instrumentId === instrumentId && i.instrumentType === type) || null;
    }

    // Search instrument by identifier
    static async searchInstrument(userId: UUID, identifier: string): Promise<UserInstrument | null> {
        // identifier could be "XXXX5678" or "user@okaxis"
        const instruments = await this.getUserInstruments(userId);

        // Exact match on mask
        const match = instruments.find(i => i.identifierMask === identifier);
        if (match) return match;

        // Try suffix match if identifier is like "1234"
        if (identifier.length === 4 && /^\d+$/.test(identifier)) {
            return instruments.find(i => i.last4Digits === identifier) || null;
        }

        // Fallback to repo for safety (though cache should have it)
        return UserInstrumentRepository.findByIdentifierMask(userId, identifier);
    }

    // Register new instrument (auto-populates user_instruments)
    static async registerInstrument(userId: UUID, data: {
        instrumentType: 'credit_card' | 'debit_card' | 'bank_account' | 'upi_handle',
        instrumentId: UUID,
        identifierMask: string,
        last4Digits?: string,
        bankId: UUID,
        bankAccountId?: UUID
    }): Promise<UserInstrument> {
        const instrument = await UserInstrumentRepository.create({
            userId,
            ...data,
            isActive: true
        });

        this.clearCache(userId);
        return instrument;
    }

    // List instruments by type
    static async getInstrumentsByType(userId: UUID, type: string): Promise<UserInstrument[]> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.filter(i => i.instrumentType === type);
    }

    // Get user's primary instruments (1 card, 1 debit, 1 UPI per bank)
    static async getPrimaryInstruments(userId: UUID): Promise<UserInstrument[]> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.filter(i => i.isPrimary);
    }

    // Cache invalidation
    static clearCache(userId: UUID): void {
        this.userInstrumentCache.delete(userId);
    }

    static clearAllCache(): void {
        this.userInstrumentCache.clear();
    }
}
