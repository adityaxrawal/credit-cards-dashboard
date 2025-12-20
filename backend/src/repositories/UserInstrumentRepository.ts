import { query } from '../lib/db';
import { UserInstrument, UUID } from '../types/instruments.types';

export class UserInstrumentRepository {
    static async findByUserId(userId: UUID): Promise<UserInstrument[]> {
        const result = await query('SELECT * FROM user_instruments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    static async findByUserAndType(userId: UUID, type: string): Promise<UserInstrument[]> {
        const result = await query('SELECT * FROM user_instruments WHERE user_id = $1 AND instrument_type = $2', [userId, type]);
        return result.rows;
    }

    static async findByUserAndId(userId: UUID, id: UUID): Promise<UserInstrument | null> {
        const result = await query('SELECT * FROM user_instruments WHERE user_id = $1 AND instrument_id = $2 LIMIT 1', [userId, id]);
        return result.rows[0] || null;
    }

    static async findByIdentifierMask(userId: UUID, mask: string): Promise<UserInstrument | null> {
        const result = await query(
            'SELECT * FROM user_instruments WHERE user_id = $1 AND identifier_mask = $2 LIMIT 1',
            [userId, mask]
        );
        return result.rows[0] || null;
    }

    static async create(data: Partial<UserInstrument>): Promise<UserInstrument> {
        const result = await query(
            `INSERT INTO user_instruments (
        user_id, instrument_type, instrument_id, identifier_mask, 
        last4_digits, bank_id, bank_account_id, is_active, is_primary, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
            [
                data.userId, data.instrumentType, data.instrumentId, data.identifierMask,
                data.last4Digits, data.bankId, data.bankAccountId, data.isActive !== false,
                data.isPrimary || false, data.notes
            ]
        );
        return result.rows[0];
    }

    static async update(id: UUID, data: Partial<UserInstrument>): Promise<UserInstrument> {
        const fields = Object.keys(data).filter(key => data[key as keyof UserInstrument] !== undefined && key !== 'id' && key !== 'userId');
        if (fields.length === 0) return (await query('SELECT * FROM user_instruments WHERE id = $1', [id])).rows[0];

        const setClause = fields.map((field, index) => {
            const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            return `${dbField} = $${index + 2}`;
        }).join(', ');

        const values = fields.map(field => data[field as keyof UserInstrument]);

        const result = await query(
            `UPDATE user_instruments SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0];
    }

    static async delete(id: UUID): Promise<void> {
        await query('DELETE FROM user_instruments WHERE id = $1', [id]);
    }

    static async deleteByInstrument(instrumentId: UUID): Promise<void> {
        await query('DELETE FROM user_instruments WHERE instrument_id = $1', [instrumentId]);
    }
}
