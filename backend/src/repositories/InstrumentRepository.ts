import { query } from '../lib/db';
import { Instrument, InstrumentType, UUID } from '../types/instruments.types';

export class InstrumentRepository {
    static async findByUserId(userId: UUID): Promise<Instrument[]> {
        const result = await query('SELECT * FROM instruments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows.map(this.mapRowToInstrument);
    }

    static async findByType(userId: UUID, type: InstrumentType): Promise<Instrument[]> {
        const result = await query('SELECT * FROM instruments WHERE user_id = $1 AND type = $2', [userId, type]);
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
}
