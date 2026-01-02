/**
 * Instrument Legacy Repository
 * Data access layer for InstrumentService (legacy)
 */

import { query } from '../lib/db';

export interface LegacyInstrumentRow {
    id: string;
    user_id: string;
    instrument_type: string;
    bank_name: string;
    account_number_masked: string;
    is_active: boolean;
    is_primary: boolean;
    instrument_id: string;
}

export class InstrumentLegacyRepository {
    /**
     * Get all active instruments for a user (legacy format)
     */
    static async getUserInstruments(userId: string): Promise<LegacyInstrumentRow[]> {
        const result = await query(
            `SELECT 
                ui.id, 
                ui.user_id, 
                ui.type as instrument_type, 
                b.name as bank_name, 
                COALESCE(ui.identifier, CONCAT('XXXX', ui.last4)) as account_number_masked,
                CASE WHEN ui.status = 'active' THEN true ELSE false END as is_active, 
                ui.is_primary,
                ui.id as instrument_id
             FROM instruments ui
             LEFT JOIN banks b ON ui.bank_id = b.id
             WHERE ui.user_id = $1 AND ui.status = 'active'`,
            [userId]
        );
        return result.rows;
    }
}
