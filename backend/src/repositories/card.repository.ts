import { query } from '../lib/db';

export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  bank_name: string;
  card_number_last4: string;
  bill_date: number;
  due_date: number;
  credit_limit: number;
  current_balance: number;
  is_active: boolean;
  card_activation_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export class CardRepository {
  static async getUserCards(userId: string): Promise<Card[]> {
    const result = await query(
      `SELECT * FROM credit_cards 
       WHERE user_id = $1 AND is_active = true 
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getCardById(userId: string, cardId: string): Promise<Card | null> {
    const result = await query(
      `SELECT * FROM credit_cards 
       WHERE id = $1 AND user_id = $2`,
      [cardId, userId]
    );
    return result.rows[0] || null;
  }

  static async createCard(data: {
    userId: string;
    cardName: string;
    bankName: string;
    lastFour: string;
    billDate: number;
    dueDate: number;
    creditLimit: number;
    activationDate?: Date;
    notes?: string;
  }): Promise<Card> {
    const result = await query(
      `INSERT INTO credit_cards (
        user_id, card_name, bank_name, card_number_last4, 
        bill_date, due_date, credit_limit, card_activation_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.userId,
        data.cardName,
        data.bankName,
        data.lastFour,
        data.billDate,
        data.dueDate,
        data.creditLimit,
        data.activationDate || null,
        data.notes || null,
      ]
    );
    return result.rows[0];
  }

  static async updateCard(
    userId: string,
    cardId: string,
    data: Partial<{
      cardName: string;
      bankName: string;
      billDate: number;
      dueDate: number;
      creditLimit: number;
      currentBalance: number;
      notes: string;
    }>
  ): Promise<Card | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.cardName !== undefined) {
      updates.push(`card_name = $${paramIndex++}`);
      values.push(data.cardName);
    }
    if (data.bankName !== undefined) {
      updates.push(`bank_name = $${paramIndex++}`);
      values.push(data.bankName);
    }
    if (data.billDate !== undefined) {
      updates.push(`bill_date = $${paramIndex++}`);
      values.push(data.billDate);
    }
    if (data.dueDate !== undefined) {
      updates.push(`due_date = $${paramIndex++}`);
      values.push(data.dueDate);
    }
    if (data.creditLimit !== undefined) {
      updates.push(`credit_limit = $${paramIndex++}`);
      values.push(data.creditLimit);
    }
    if (data.currentBalance !== undefined) {
      updates.push(`current_balance = $${paramIndex++}`);
      values.push(data.currentBalance);
    }
    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = NOW()`);
    values.push(cardId, userId);

    const result = await query(
      `UPDATE credit_cards 
       SET ${updates.join(', ')} 
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async deleteCard(userId: string, cardId: string): Promise<boolean> {
    const result = await query(
      `UPDATE credit_cards 
       SET is_active = false, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [cardId, userId]
    );
    return (result.rowCount || 0) > 0;
  }

  static async findCardByBankAndLastFour(
    userId: string,
    bankName: string,
    lastFour: string
  ): Promise<Card | null> {
    const result = await query(
      `SELECT * FROM credit_cards 
       WHERE user_id = $1 
         AND LOWER(bank_name) = LOWER($2) 
         AND card_number_last4 = $3 
         AND is_active = true
       LIMIT 1`,
      [userId, bankName, lastFour]
    );
    return result.rows[0] || null;
  }

  static async getCardUtilization(cardId: string): Promise<number> {
    const result = await query(
      `SELECT COALESCE(SUM(amount), 0) as outstanding
       FROM transactions
       WHERE card_id = $1 
         AND transaction_type = 'debit'
         AND is_settled = false`,
      [cardId]
    );
    return parseFloat(result.rows[0].outstanding || '0');
  }
}
