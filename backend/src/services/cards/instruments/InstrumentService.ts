import pool from '../../lib/db';
import { Instrument, InstrumentType } from '../../types/transaction.types';
import logger from '../../utils/infrastructure/logger';
import { InstrumentRegistry } from './InstrumentRegistry';

// In-memory cache: userId -> { timestamp, instruments[] }
const instrumentCache = new Map<string, { timestamp: number; instruments: Instrument[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @deprecated Use InstrumentRegistry and specific services instead.
 * This class is maintained for backward compatibility with the legacy pipeline.
 */
export class InstrumentService {
    /**
     * Get all active instruments for a user (with caching)
     */
    static async getUserInstruments(userId: string): Promise<Instrument[]> {
        const cached = instrumentCache.get(userId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
            return cached.instruments;
        }

        try {
            // Join with banks to get names (legacy expects bank_name)
            const result = await pool.query(
                `SELECT 
                    ui.id, 
                    ui.user_id, 
                    ui.instrument_type, 
                    b.name as bank_name, 
                    ui.identifier_mask as account_number_masked,
                    ui.is_active, 
                    ui.is_primary,
                    ui.instrument_id
                 FROM user_instruments ui
                 LEFT JOIN banks b ON ui.bank_id = b.id
                 WHERE ui.user_id = $1 AND ui.is_active = true`,
                [userId]
            );

            const instruments = result.rows.map(row => ({
                id: row.id,
                user_id: row.user_id,
                instrument_type: row.instrument_type as InstrumentType,
                bank_name: row.bank_name,
                account_number_masked: row.account_number_masked,
                is_active: row.is_active,
                is_primary: row.is_primary,
                // These might be missing in new schema but we can fill if we detect them
                upi_handle: row.instrument_type === 'upi_handle' ? row.account_number_masked : undefined,
                card_name: (row.instrument_type === 'credit_card' || row.instrument_type === 'debit_card') ? row.bank_name : undefined
            })) as Instrument[];

            instrumentCache.set(userId, { timestamp: Date.now(), instruments });
            return instruments;
        } catch (error) {
            logger.error(`Failed to get instruments for user ${userId}`, error);
            throw error;
        }
    }

    /**
     * Find a credit/debit card by bank name and last 4 digits
     */
    static async getCardByIdentifier(
        userId: string,
        bankName: string,
        last4: string
    ): Promise<Instrument | null> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.find(i =>
            (i.instrument_type === InstrumentType.CREDIT_CARD || i.instrument_type === InstrumentType.DEBIT_CARD) &&
            i.account_number_masked.endsWith(last4) &&
            (i.bank_name.toLowerCase().includes(bankName.toLowerCase()) || bankName.toLowerCase().includes(i.bank_name.toLowerCase()))
        ) || null;
    }

    /**
     * Find a bank account by bank name and last 4 digits
     */
    static async getAccountByIdentifier(
        userId: string,
        bankName: string,
        last4: string
    ): Promise<Instrument | null> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.find(i =>
            (i.instrument_type === InstrumentType.BANK_ACCOUNT || i.instrument_type === InstrumentType.SAVINGS_ACCOUNT) &&
            i.account_number_masked.endsWith(last4) &&
            (i.bank_name.toLowerCase().includes(bankName.toLowerCase()) || bankName.toLowerCase().includes(i.bank_name.toLowerCase()))
        ) || null;
    }

    /**
     * Find instrument by UPI handle
     */
    static async getUPIByHandle(userId: string, upiHandle: string): Promise<Instrument | null> {
        const instruments = await this.getUserInstruments(userId);
        return instruments.find(i => i.instrument_type === InstrumentType.UPI && i.account_number_masked === upiHandle) || null;
    }

    static clearCache(userId: string): void {
        instrumentCache.delete(userId);
        InstrumentRegistry.clearCache(userId);
    }

    static clearAllCache(): void {
        instrumentCache.clear();
        InstrumentRegistry.clearAllCache();
    }
}
