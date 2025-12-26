import { InstrumentRepository } from '../../../repositories/InstrumentRepository';
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
            // Fetch all types and aggregate
            // Optimized: create a findByUser in InstrumentRepository or use direct query here if not available
            // Assuming InstrumentRepository needs an update or we use finding by types
            const types = ['credit_card', 'debit_card', 'bank_account', 'upi_handle'] as const;
            const promises = types.map(t => InstrumentRepository.findByType(userId, t));
            const results = await Promise.all(promises);
            const instruments = results.flat();

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
        return instruments.find(i => i.id === instrumentId && i.type === type) || null;
    }

    // Search instrument by identifier
    static async searchInstrument(userId: UUID, identifier: string): Promise<UserInstrument | null> {
        // identifier could be "XXXX5678" or "user@okaxis"
        const instruments = await this.getUserInstruments(userId);

        // Exact match on identifier
        const match = instruments.find(i => i.identifier === identifier);
        if (match) return match;

        // Try suffix match if identifier is like "1234" (last4)
        if (identifier.length === 4 && /^\d+$/.test(identifier)) {
            return instruments.find(i => i.last4 === identifier) || null;
        }

        return null;
    }

    // Register new instrument (legacy wrapper, use specific service/repo instead)
    static async registerInstrument(userId: UUID, data: {
        instrumentType: 'credit_card' | 'debit_card' | 'bank_account' | 'upi_handle',
        instrumentId: UUID, // This assumes ID is already known or generated? 
        // In legacy this might have been creating a LINK.
        // With unified table, registration usually means CREATION.
        // If this was linking, it's now redundant or part of creation.
        // We will assume this is mostly for cache invalidation now or simple passthrough.
        identifierMask: string,
        last4Digits?: string,
        bankId: UUID,
        bankAccountId?: UUID
    }): Promise<UserInstrument> {
        // This method seems to assume the instrument already exists or is being created elsewhere
        // and this was just adding to user_instruments.
        // Since we don't have user_instruments, we just ensure cache is cleared.
        // If the caller expects a return, we try to fetch it.

        this.clearCache(userId);

        // Return fetched instrument
        const inst = await this.getInstrument(userId, data.instrumentId, data.instrumentType);
        if (!inst) throw new Error("Instrument not found after registration");
        return inst;
    }

    // List instruments by type
    static async getInstrumentsByType(userId: UUID, type: string): Promise<UserInstrument[]> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.filter(i => i.type === type);
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
