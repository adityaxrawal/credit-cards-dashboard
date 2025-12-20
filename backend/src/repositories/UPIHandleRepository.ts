import { query } from '../lib/db';
import { UPIHandle, UUID } from '../types/instruments.types';

export class UPIHandleRepository {
    static async findByUserId(userId: UUID): Promise<UPIHandle[]> {
        const result = await query('SELECT * FROM upi_handles WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    static async findByAccountId(accountId: UUID): Promise<UPIHandle[]> {
        const result = await query('SELECT * FROM upi_handles WHERE bank_account_id = $1', [accountId]);
        return result.rows;
    }

    static async findByHandle(upiHandle: string): Promise<UPIHandle | null> {
        const result = await query('SELECT * FROM upi_handles WHERE upi_handle = $1 LIMIT 1', [upiHandle]);
        return result.rows[0] || null;
    }

    static async findByUserAndHandle(userId: UUID, upiHandle: string): Promise<UPIHandle | null> {
        const result = await query(
            'SELECT * FROM upi_handles WHERE user_id = $1 AND upi_handle = $2 LIMIT 1',
            [userId, upiHandle]
        );
        return result.rows[0] || null;
    }

    static async findById(id: UUID): Promise<UPIHandle | null> {
        const result = await query('SELECT * FROM upi_handles WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async create(data: Partial<UPIHandle>): Promise<UPIHandle> {
        const result = await query(
            `INSERT INTO upi_handles (
        user_id, bank_id, bank_account_id, upi_handle, upi_provider, 
        is_primary, is_active, daily_limit, monthly_limit, registered_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING *`,
            [
                data.userId, data.bankId, data.bankAccountId, data.upiHandle, data.upiProvider,
                data.isPrimary || false, data.isActive !== false, data.dailyLimit,
                data.monthlyLimit, data.registeredPhone
            ]
        );
        return result.rows[0];
    }

    static async update(id: UUID, data: Partial<UPIHandle>): Promise<UPIHandle> {
        const fields = Object.keys(data).filter(key => data[key as keyof UPIHandle] !== undefined && key !== 'id' && key !== 'userId');
        if (fields.length === 0) return this.findById(id) as any;

        const setClause = fields.map((field, index) => {
            const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            return `${dbField} = $${index + 2}`;
        }).join(', ');

        const values = fields.map(field => {
            const val = data[field as keyof UPIHandle];
            return (typeof val === 'object' && val !== null && !(val instanceof Date)) ? JSON.stringify(val) : val;
        });

        const result = await query(
            `UPDATE upi_handles SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0];
    }

    static async delete(id: UUID): Promise<void> {
        await query('DELETE FROM upi_handles WHERE id = $1', [id]);
    }
}
