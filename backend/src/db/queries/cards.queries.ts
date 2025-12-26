import pool from '../../lib/db';

import { Card } from '../../types/db.types';

/**
 * Get all cards for a user with calculated utilization
 */
export async function getUserCards(userId: string): Promise<Array<Card & { outstanding_balance: number }>> {
  const { rows } = await pool.query(
    `SELECT 
      i.id,
      i.user_id,
      i.bank_id,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4,
      i.identifier as card_number_masked,
      (i.metadata->>'card_type')::varchar as card_type,
      (i.metadata->>'bill_date')::int as bill_date,
      (i.metadata->>'due_date')::int as due_date,
      (i.metadata->>'credit_limit')::decimal as credit_limit,
      i.balance as current_balance,
      i.is_primary,
      (i.metadata->>'notes')::varchar as notes,
      (i.metadata->>'activation_date')::timestamp as card_activation_date,
      i.status = 'active' as is_active,
      i.created_at,
      i.updated_at,
      
      COALESCE((
        SELECT (
          COALESCE(SUM(CASE WHEN t.direction = 'debit' THEN t.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount ELSE 0 END), 0)
        )
        FROM transactions t 
        WHERE t.instrument_id = i.id 
          AND t.is_settled = false
      ), 0) as outstanding_balance
     FROM instruments i
     LEFT JOIN banks b ON i.bank_id = b.id
     WHERE i.user_id = $1 AND i.type = 'credit_card' AND i.status = 'active'
     ORDER BY i.created_at DESC`,
    [userId]
  );
  return rows.map(row => ({
    ...row,
    outstanding_balance: parseFloat(row.outstanding_balance)
  }));
}

/**
 * Get a single card by ID
 */
export async function getCardById(userId: string, cardId: string): Promise<Card | null> {
  const { rows } = await pool.query(
    `SELECT 
      i.id,
      i.user_id,
      i.bank_id,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4,
      i.identifier as card_number_masked,
      (i.metadata->>'card_type')::varchar as card_type,
      (i.metadata->>'bill_date')::int as bill_date,
      (i.metadata->>'due_date')::int as due_date,
      (i.metadata->>'credit_limit')::decimal as credit_limit,
      i.balance as current_balance,
      i.is_primary,
      (i.metadata->>'notes')::varchar as notes,
      (i.metadata->>'activation_date')::timestamp as card_activation_date,
      i.status = 'active' as is_active,
      i.created_at,
      i.updated_at
     FROM instruments i
     LEFT JOIN banks b ON i.bank_id = b.id
     WHERE i.id = $1 AND i.user_id = $2 AND i.type = 'credit_card'`,
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
  const client = await pool.connect();
  try {
    // First, find or create bank
    let bankId: string | null = null;
    const bankRes = await client.query('SELECT id FROM banks WHERE name = $1', [data.bankName]);
    if (bankRes.rows.length > 0) {
      bankId = bankRes.rows[0].id;
    } else {
      // Create simplified bank entry if not exists (though ideally banks are pre-seeded)
      const newBank = await client.query('INSERT INTO banks (name, type) VALUES ($1, $2) RETURNING id', [data.bankName, 'retail']);
      bankId = newBank.rows[0].id;
    }

    const { rows } = await client.query(
      `INSERT INTO instruments (
        user_id, type, bank_id, name, last4, identifier,
        metadata, status
      ) VALUES ($1, 'credit_card', $2, $3, $4, $4, $5, 'active')
      RETURNING *`,
      [
        data.userId,
        bankId,
        data.cardName,
        data.lastFour,
        JSON.stringify({
          bill_date: data.billDate,
          due_date: data.dueDate,
          credit_limit: data.creditLimit,
          activation_date: data.activationDate,
          notes: data.notes
        })
      ]
    );

    const i = rows[0];
    // Map back to Card interface
    return {
      id: i.id,
      user_id: i.user_id,
      card_name: i.name,
      bank_name: data.bankName,
      card_number_last4: i.last4,
      card_number_masked: i.identifier,
      bill_date: i.metadata.bill_date,
      due_date: i.metadata.due_date,
      credit_limit: i.metadata.credit_limit,
      is_active: i.status === 'active',
      created_at: i.created_at,
      updated_at: i.updated_at,
      // ... other fields as needed
    } as any;

  } catch (error: any) {
    // Handle unique constraint violation (duplicate card)
    // We need to check instruments unique constraint (user_id, type, last4 maybe? or just rely on manual checks)
    // The previous code handled 23505.
    if (error.code === '23505') {
      console.log(`[CardQueries] Duplicate card detected for ${data.bankName} ${data.lastFour}, returning existing card.`);
      const existingCard = await findCardByBankAndLastFour(data.userId, data.bankName, data.lastFour);
      if (existingCard) {
        return existingCard;
      }
    }
    throw error;
  } finally {
    client.release();
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
  let metadataUpdates: any = {};
  let metadataUpdateNeeded = false;

  if (data.cardName !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.cardName);
  }
  // Bank name update would require changing bank_id, simplifying to ignore for now or handle separately if strictly needed.
  // if (data.bankName !== undefined) { ... }

  if (data.billDate !== undefined) {
    metadataUpdates.bill_date = data.billDate;
    metadataUpdateNeeded = true;
  }
  if (data.dueDate !== undefined) {
    metadataUpdates.due_date = data.dueDate;
    metadataUpdateNeeded = true;
  }
  if (data.creditLimit !== undefined) {
    metadataUpdates.credit_limit = data.creditLimit;
    metadataUpdateNeeded = true;
  }
  if (data.notes !== undefined) {
    metadataUpdates.notes = data.notes;
    metadataUpdateNeeded = true;
  }

  if (data.currentBalance !== undefined) {
    updates.push(`balance = $${paramIndex++}`);
    values.push(data.currentBalance);
  }

  if (metadataUpdateNeeded) {
    // This is tricky with plain SQL concatenation. 
    // safer to coalesce existing metadata.
    updates.push(`metadata = metadata || $${paramIndex++}`);
    values.push(JSON.stringify(metadataUpdates));
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = NOW()`);
  values.push(cardId, userId);

  const { rows } = await pool.query(
    `UPDATE instruments 
     SET ${updates.join(', ')} 
     WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} AND type = 'credit_card'
     RETURNING *`,
    values
  );

  const i = rows[0];
  if (!i) return null;

  // Ideally fetching bank name too
  const bankRes = await pool.query('SELECT name FROM banks WHERE id = $1', [i.bank_id]);
  const bankName = bankRes.rows[0]?.name;

  return {
    id: i.id,
    user_id: i.user_id,
    card_name: i.name,
    bank_name: bankName,
    card_number_last4: i.last4,
    card_number_masked: i.identifier,
    current_balance: parseFloat(i.balance),
    bill_date: i.metadata.bill_date,
    due_date: i.metadata.due_date,
    credit_limit: i.metadata.credit_limit,
    is_active: i.status === 'active',
    created_at: i.created_at,
    updated_at: i.updated_at
  } as any;
}

/**
 * Soft delete a card
 */
export async function deleteCard(userId: string, cardId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE instruments 
     SET status = 'inactive', updated_at = NOW() 
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
    `SELECT i.*, b.name as bank_name
     FROM instruments i
     LEFT JOIN banks b ON i.bank_id = b.id
     WHERE i.user_id = $1 
       AND LOWER(b.name) = LOWER($2) 
       AND i.last4 = $3 
       AND i.status = 'active'
       AND i.type = 'credit_card'
     LIMIT 1`,
    [userId, bankName, lastFour]
  );

  if (!rows[0]) return null;

  const i = rows[0];
  return {
    id: i.id,
    user_id: i.user_id,
    card_name: i.name,
    bank_name: i.bank_name,
    card_number_last4: i.last4,
    card_number_masked: i.identifier,
    bill_date: i.metadata.bill_date,
    due_date: i.metadata.due_date,
    credit_limit: i.metadata.credit_limit,
    is_active: i.status === 'active',
    created_at: i.created_at,
    updated_at: i.updated_at
  } as any;
}

/**
 * Find card by last four digits (ignoring bank name)
 * Used for normalization to avoid duplicates
 */
export async function findCardByLastFour(
  userId: string,
  lastFour: string
): Promise<Card | null> {
  const { rows } = await pool.query(
    `SELECT i.*, b.name as bank_name
     FROM instruments i
     LEFT JOIN banks b ON i.bank_id = b.id
     WHERE i.user_id = $1 
       AND i.last4 = $2 
       AND i.status = 'active'
       AND i.type = 'credit_card'
     LIMIT 1`,
    [userId, lastFour]
  );

  if (!rows[0]) return null;
  const i = rows[0];

  return {
    id: i.id,
    user_id: i.user_id,
    card_name: i.name,
    bank_name: i.bank_name,
    card_number_last4: i.last4,
    card_number_masked: i.identifier,
    bill_date: i.metadata.bill_date,
    due_date: i.metadata.due_date,
    credit_limit: i.metadata.credit_limit,
    is_active: i.status === 'active',
    created_at: i.created_at,
    updated_at: i.updated_at
  } as any;
}

/**
 * Get card utilization (sum of outstanding transactions)
 */
export async function getCardUtilization(cardId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT (
        COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0)
     ) as outstanding
     FROM transactions
     WHERE instrument_id = $1 
       AND is_settled = false`,
    [cardId]
  );
  return parseFloat(rows[0].outstanding || '0');
}
