import { query } from '../lib/db';
import { CreditCard, UUID } from '../types/instruments.types';

export class CreditCardRepository {
    static async findByUserId(userId: UUID): Promise<CreditCard[]> {
        const result = await query('SELECT * FROM credit_cards WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return result.rows;
    }

    static async findByUserAndLast4(userId: UUID, last4: string): Promise<CreditCard | null> {
        const result = await query(
            'SELECT * FROM credit_cards WHERE user_id = $1 AND card_number_last4 = $2 LIMIT 1',
            [userId, last4]
        );
        return result.rows[0] || null;
    }

    static async findByAccountId(accountId: UUID): Promise<CreditCard[]> {
        const result = await query('SELECT * FROM credit_cards WHERE bank_account_id = $1', [accountId]);
        return result.rows;
    }

    static async findById(id: UUID): Promise<CreditCard | null> {
        const result = await query('SELECT * FROM credit_cards WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async create(data: Partial<CreditCard>): Promise<CreditCard> {
        const result = await query(
            `INSERT INTO credit_cards (
        user_id, bank_id, bank_account_id, card_name, card_network, 
        card_number_last4, card_number_masked, card_type, bill_date, 
        due_date, credit_limit, current_balance, is_primary, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
       RETURNING *`,
            [
                data.userId, data.bankId, data.bankAccountId, data.cardName, data.cardNetwork,
                data.cardNumberLast4, data.cardNumberMasked, data.cardType || 'credit',
                data.billDate, data.dueDate, data.creditLimit, data.currentBalance || 0,
                data.isPrimary || false, data.notes, data.metadata ? JSON.stringify(data.metadata) : null
            ]
        );
        return result.rows[0];
    }

    static async update(id: UUID, data: Partial<CreditCard>): Promise<CreditCard> {
        const fields = Object.keys(data).filter(key => data[key as keyof CreditCard] !== undefined && key !== 'id' && key !== 'userId');
        if (fields.length === 0) return this.findById(id) as any;

        const setClause = fields.map((field, index) => {
            const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
            return `${dbField} = $${index + 2}`;
        }).join(', ');

        const values = fields.map(field => {
            const val = data[field as keyof CreditCard];
            return (typeof val === 'object' && val !== null && !(val instanceof Date)) ? JSON.stringify(val) : val;
        });

        const result = await query(
            `UPDATE credit_cards SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, ...values]
        );
        return result.rows[0];
    }

    static async delete(id: UUID): Promise<void> {
        await query('DELETE FROM credit_cards WHERE id = $1', [id]);
    }
}
