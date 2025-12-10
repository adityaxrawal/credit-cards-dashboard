import pool from '../../lib/db';

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

/**
 * Get all cards for a user
 */
export async function getUserCards(userId: string): Promise<Card[]> {
  const { rows } = await pool.query(
    `SELECT * FROM credit_cards 
     WHERE user_id = $1 AND is_active = true 
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Get a single card by ID
 */
export async function getCardById(userId: string, cardId: string): Promise<Card | null> {
  const { rows } = await pool.query(
    `SELECT * FROM credit_cards 
     WHERE id = $1 AND user_id = $2`,
    [cardId, userId]
  );
  return rows[0] || null;
}

/**
 * Create a new card
 */
export async function createCard(data: {
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
  try {
    const { rows } = await pool.query(
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
    return rows[0];
  } catch (error: any) {
    // Handle unique constraint violation (duplicate card)
    if (error.code === '23505') { // Postgres unique violation code
      console.log(`[CardQueries] Duplicate card detected for ${data.bankName} ${data.lastFour}, returning existing card.`);
      const existingCard = await findCardByBankAndLastFour(data.userId, data.bankName, data.lastFour);
      if (existingCard) {
        return existingCard;
      }
    }
    throw error;
  }
}

/**
 * Update a card
 */
export async function updateCard(
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

  const { rows } = await pool.query(
    `UPDATE credit_cards 
     SET ${updates.join(', ')} 
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
     RETURNING *`,
    values
  );

  return rows[0] || null;
}

/**
 * Soft delete a card
 */
export async function deleteCard(userId: string, cardId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE credit_cards 
     SET is_active = false, updated_at = NOW() 
     WHERE id = $1 AND user_id = $2`,
    [cardId, userId]
  );
  return (rowCount || 0) > 0;
}

/**
 * Find card by bank name and last four digits
 */
export async function findCardByBankAndLastFour(
  userId: string,
  bankName: string,
  lastFour: string
): Promise<Card | null> {
  const { rows } = await pool.query(
    `SELECT * FROM credit_cards 
     WHERE user_id = $1 
       AND LOWER(bank_name) = LOWER($2) 
       AND card_number_last4 = $3 
       AND is_active = true
     LIMIT 1`,
    [userId, bankName, lastFour]
  );
  return rows[0] || null;
}

/**
 * Find card by last four digits (when bank name is unknown)
 */
export async function findCardByLastFour(
  userId: string,
  lastFour: string
): Promise<Card | null> {
  const { rows } = await pool.query(
    `SELECT * FROM credit_cards 
     WHERE user_id = $1 
       AND card_number_last4 = $2 
       AND is_active = true
     LIMIT 1`,
    [userId, lastFour]
  );
  return rows[0] || null;
}

/**
 * Get card utilization (sum of outstanding transactions)
 */
export async function getCardUtilization(cardId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as outstanding
     FROM transactions
     WHERE card_id = $1 
       AND transaction_type = 'debit'
       AND is_settled = false`,
    [cardId]
  );
  return parseFloat(rows[0].outstanding || '0');
}

/**
 * Get card utilization for multiple cards (Batch)
 */
export async function getBatchCardUtilization(cardIds: string[]): Promise<Map<string, number>> {
  if (cardIds.length === 0) return new Map();

  const { rows } = await pool.query(
    `SELECT card_id, COALESCE(SUM(amount), 0) as outstanding
     FROM transactions
     WHERE card_id = ANY($1) 
       AND transaction_type = 'debit'
       AND is_settled = false
     GROUP BY card_id`,
    [cardIds]
  );

  const map = new Map<string, number>();
  rows.forEach(row => {
    map.set(row.card_id, parseFloat(row.outstanding));
  });

  return map;
}
