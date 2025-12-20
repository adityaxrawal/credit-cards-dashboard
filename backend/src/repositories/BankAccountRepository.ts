import { query } from '../lib/db';
import { BankAccount, UUID } from '../types/instruments.types';

export class BankAccountRepository {
    static async findByUserId(userId: UUID): Promise<BankAccount[]> {
        const result = await query('SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    static async findByUserAndBank(userId: UUID, bankId: UUID): Promise<BankAccount[]> {
        const result = await query('SELECT * FROM bank_accounts WHERE user_id = $1 AND bank_id = $2', [userId, bankId]);
        return result.rows;
    }

    static async findById(id: UUID): Promise<BankAccount | null> {
        const result = await query('SELECT * FROM bank_accounts WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async findByUserAndMasked(userId: UUID, masked: string): Promise<BankAccount | null> {
        const result = await query(
            'SELECT * FROM bank_accounts WHERE user_id = $1 AND account_number_masked = $2 LIMIT 1',
            [userId, masked]
        );
        return result.rows[0] || null;
    }

    static async create(data: Partial<BankAccount>): Promise<BankAccount> {
        const result = await query(
            `INSERT INTO bank_accounts (
        user_id, bank_id, account_number_masked, account_type, 
        account_holder_name, upi_handle, is_primary, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
            [
                data.userId, data.bankId, data.accountNumberMasked, data.accountType,
                data.accountHolderName, data.upiHandle, data.isPrimary || false,
                data.notes, data.metadata ? JSON.stringify(data.metadata) : null
            ]
        );
        return result.rows[0];
    }

    static async update(id: UUID, data: Partial<BankAccount>): Promise<BankAccount> {
        const fields = Object.keys(data).filter(key => data[key as keyof BankAccount] !== undefined && key !== 'id' && key !== 'userId');
        const setClause = fields.map((field, index) => {
            const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            return `${dbField} = $${index + 2}`;
        }).join(', ');

        const values = fields.map(field => {
            const val = data[field as keyof BankAccount];
            return typeof val === 'object' ? JSON.stringify(val) : val;
        });

        const result = await query(
            `UPDATE bank_accounts SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0];
    }

    static async delete(id: UUID): Promise<void> {
        await query('DELETE FROM bank_accounts WHERE id = $1', [id]);
    }
}
