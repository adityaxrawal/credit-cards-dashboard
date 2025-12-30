import pool from '../../lib/db';

/**
 * Get all bills for a user
 */
/**
 * Get all bills for a user with cursor pagination
 */
export async function getAllBills(userId: string, limit: number = 50, cursor?: { dueDate: Date, id: string }) {
  const queryParams: any[] = [userId, limit + 1];
  let paramCount = 2;
  let cursorCondition = '';

  if (cursor) {
    cursorCondition = `AND (bp.due_date, bp.id) < ($${paramCount + 1}, $${paramCount + 2})`;
    queryParams.push(cursor.dueDate, cursor.id);
    paramCount += 2;
  }

  const result = await pool.query(
    `SELECT 
      bp.*,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4
    FROM bill_payments bp
    INNER JOIN instruments i ON bp.instrument_id = i.id
    LEFT JOIN banks b ON i.bank_id = b.id
    WHERE i.user_id = $1 AND i.type = 'credit_card'
    ${cursorCondition}
    ORDER BY bp.due_date DESC, bp.id DESC
    LIMIT $2`,
    queryParams
  );

  return result.rows;
}

/**
 * Get a single bill by ID
 */
export async function getBillById(userId: string, billId: string) {
  const result = await pool.query(
    `SELECT 
      bp.*,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4
    FROM bill_payments bp
    INNER JOIN instruments i ON bp.instrument_id = i.id
    LEFT JOIN banks b ON i.bank_id = b.id
    WHERE bp.id = $1 AND i.user_id = $2`,
    [billId, userId]
  );

  return result.rows[0];
}

/**
 * Get bills for a specific card
 */
/**
 * Get bills for a specific card with cursor pagination
 */
export async function getCardBills(userId: string, cardId: string, limit: number = 50, cursor?: { dueDate: Date, id: string }) {
  const queryParams: any[] = [cardId, userId, limit + 1];
  let paramCount = 3;
  let cursorCondition = '';

  if (cursor) {
    cursorCondition = `AND (bp.due_date, bp.id) < ($${paramCount + 1}, $${paramCount + 2})`;
    queryParams.push(cursor.dueDate, cursor.id);
    paramCount += 2;
  }

  const result = await pool.query(
    `SELECT 
      bp.*,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4
    FROM bill_payments bp
    INNER JOIN instruments i ON bp.instrument_id = i.id
    LEFT JOIN banks b ON i.bank_id = b.id
    WHERE bp.instrument_id = $1 AND i.user_id = $2
    ${cursorCondition}
    ORDER BY bp.due_date DESC, bp.id DESC
    LIMIT $3`,
    queryParams
  );

  return result.rows;
}

/**
 * Get upcoming bills (unpaid/pending)
 */
export async function getUpcomingBills(userId: string, limit: number = 20, offset: number = 0) {
  const result = await pool.query(
    `SELECT 
      bp.*,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4
    FROM bill_payments bp
    INNER JOIN instruments i ON bp.instrument_id = i.id
    LEFT JOIN banks b ON i.bank_id = b.id
    WHERE i.user_id = $1 AND i.type = 'credit_card'
      AND bp.payment_status IN ('pending', 'partial')
      AND bp.due_date >= CURRENT_DATE
    ORDER BY bp.due_date ASC
    LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
}

/**
 * Create a new bill
 */
export async function createBill(data: {
  cardId: string;
  billMonth: number;
  billYear: number;
  billAmount: number;
  billDate: Date;
  dueDate: Date;
  paymentStatus?: string;
  notes?: string;
}) {
  const result = await pool.query(
    `INSERT INTO bill_payments (
      instrument_id, bill_month, bill_year, bill_amount, 
      bill_date, due_date, payment_status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      data.cardId,
      data.billMonth,
      data.billYear,
      data.billAmount,
      data.billDate,
      data.dueDate,
      data.paymentStatus || 'pending',
      data.notes || null,
    ]
  );

  return result.rows[0];
}

/**
 * Update a bill
 */
export async function updateBill(
  userId: string,
  billId: string,
  data: Partial<{
    paymentAmount: number;
    paymentDate: Date;
    paymentStatus: string;
    paymentMethod: string;
    transactionReference: string;
    lateFee: number;
    notes: string;
  }>
) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  });

  if (fields.length === 0) {
    return null;
  }

  fields.push(`updated_at = NOW()`);
  values.push(billId, userId);

  const result = await pool.query(
    `UPDATE bill_payments bp
    SET ${fields.join(', ')}
    FROM instruments i
    WHERE bp.id = $${paramCount} 
      AND bp.instrument_id = i.id 
      AND i.user_id = $${paramCount + 1}
    RETURNING bp.*`,
    values
  );

  return result.rows[0];
}

/**
 * Delete a bill
 */
export async function deleteBill(userId: string, billId: string) {
  const result = await pool.query(
    `DELETE FROM bill_payments bp
    USING instruments i
    WHERE bp.id = $1 
      AND bp.instrument_id = i.id 
      AND i.user_id = $2
    RETURNING bp.id`,
    [billId, userId]
  );

  return result.rows.length > 0;
}
