import { query } from '@shared/database/db';
import { Instrument, InstrumentType, UUID } from '@shared/types/instruments.types';

export class InstrumentRepository {
    static async findByUserId(userId: UUID): Promise<Instrument[]> {
        const result = await query('SELECT * FROM instruments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows.map(this.mapRowToInstrument);
    }

    static async findByType(userId: UUID, type: InstrumentType): Promise<Instrument[]> {
        const result = await query('SELECT * FROM instruments WHERE user_id = $1 AND type = $2', [userId, type]);
        return result.rows.map(this.mapRowToInstrument);
    }

    static async findActiveByUserId(userId: UUID): Promise<Instrument[]> {
        const result = await query(
            'SELECT * FROM instruments WHERE user_id = $1 AND status = \'active\' ORDER BY created_at DESC',
            [userId]
        );
        return result.rows.map(this.mapRowToInstrument);
    }

    static async findById(id: UUID): Promise<Instrument | null> {
        const result = await query('SELECT * FROM instruments WHERE id = $1', [id]);
        return result.rows[0] ? this.mapRowToInstrument(result.rows[0]) : null;
    }

    static async create(data: Partial<Instrument>): Promise<Instrument> {
        const result = await query(
            `INSERT INTO instruments (
                user_id, type, bank_id, name, identifier, last4,
                balance, currency, status, is_primary, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                data.userId, data.type, data.bankId, data.name, data.identifier, data.last4,
                data.balance || 0, data.currency || 'INR', data.status || 'active',
                data.isPrimary || false, data.metadata || {}
            ]
        );
        return this.mapRowToInstrument(result.rows[0]);
    }

    static async update(id: UUID, data: Partial<Instrument>): Promise<Instrument> {
        const fields = Object.keys(data).filter(key =>
            key !== 'id' && key !== 'userId' && key !== 'createdAt' && key !== 'updatedAt' && (data as any)[key] !== undefined
        );

        if (fields.length === 0) return (await this.findById(id))!;

        const setClause = fields.map((field, index) => {
            const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            return `${dbField} = $${index + 2}`;
        }).join(', ');

        const values = fields.map(field => {
            const val = (data as any)[field];
            return (typeof val === 'object' && val !== null && !(val instanceof Date)) ? JSON.stringify(val) : val;
        });

        const result = await query(
            `UPDATE instruments SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return this.mapRowToInstrument(result.rows[0]);
    }

    static async delete(id: UUID): Promise<void> {
        await query('DELETE FROM instruments WHERE id = $1', [id]);
    }

    static async getOpeningBalance(id: UUID): Promise<number | null> {
        const result = await query('SELECT opening_balance FROM instruments WHERE id = $1', [id]);
        return result.rows[0] ? parseFloat(result.rows[0].opening_balance || '0') : null;
    }

    private static mapRowToInstrument(row: any): Instrument {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            bankId: row.bank_id,
            name: row.name,
            identifier: row.identifier,
            last4: row.last4,
            balance: parseFloat(row.balance),
            currency: row.currency,
            status: row.status,
            isPrimary: row.is_primary,
            metadata: row.metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
    static async findByBankNameAndLast4(userId: UUID, bankName: string, last4: string): Promise<Instrument | null> {
        const result = await query(
            `SELECT i.* FROM instruments i
             WHERE i.user_id = $1 AND i.last4 = $2 
             AND EXISTS (
               SELECT 1 FROM banks b WHERE b.id = i.bank_id 
               AND LOWER(b.name) = LOWER($3)
             )`,
            [userId, last4, bankName]
        );
        return result.rows[0] ? this.mapRowToInstrument(result.rows[0]) : null;
    }

    static async createSuggestion(data: {
        userId: string,
        bankId: string | null,
        type: string,
        name: string,
        last4: string
    }): Promise<void> {
        await query(
            `INSERT INTO instruments (
              user_id, bank_id, type, name, last4, status, needs_input
            ) VALUES ($1, $2, $3, $4, $5, 'active', true)
            ON CONFLICT (user_id, bank_id, type, last4) DO NOTHING`,
            [data.userId, data.bankId, data.type, data.name, data.last4]
        );
    }

    static async findIncomplete(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
        i.id, i.name, i.last4, i.type, b.name as bank_name,
        (SELECT COUNT(*) FROM transactions t WHERE t.instrument_id = i.id) as transaction_count
      FROM instruments i
      LEFT JOIN banks b ON i.bank_id = b.id
      WHERE i.user_id = $1 AND i.needs_input = true
      ORDER BY i.created_at DESC`,
            [userId]
        );
        return result.rows;
    }
    static async calculateNetWorth(userId: string): Promise<{ assets: number; liabilities: number; netWorth: number }> {
        const result = await query(
            `SELECT 
        COALESCE(SUM(CASE WHEN type NOT IN ('credit_card') THEN balance ELSE 0 END), 0) as assets,
        COALESCE(SUM(CASE WHEN type = 'credit_card' THEN ABS(balance) ELSE 0 END), 0) as liabilities
       FROM instruments 
       WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL`,
            [userId]
        );

        const assets = parseFloat(result.rows[0].assets);
        const liabilities = parseFloat(result.rows[0].liabilities);
        return { assets, liabilities, netWorth: assets - liabilities };
    }
}
