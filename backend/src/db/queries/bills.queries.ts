import pool from '../index';

/**
 * Get all bills for a user
 */
export async function getAllBills(userId: string) {
  const result = await pool.query(
    `SELECT 
      bp.*,
      cc.card_name,
      cc.bank_name,
      cc.card_number_last4
    FROM bill_payments bp
    INNER JOIN credit_cards cc ON bp.card_id = cc.id
    WHERE cc.user_id = $1
    ORDER BY bp.due_date DESC, bp.bill_date DESC`,
    [userId]
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
      cc.card_name,
      cc.bank_name,
      cc.card_number_last4
    FROM bill_payments bp
    INNER JOIN credit_cards cc ON bp.card_id = cc.id
    WHERE bp.id = $1 AND cc.user_id = $2`,
    [billId, userId]
  );
  
  return result.rows[0];
}

/**
 * Get bills for a specific card
 */
export async function getCardBills(userId: string, cardId: string) {
  const result = await pool.query(
    `SELECT 
      bp.*,
      cc.card_name,
      cc.bank_name,
      cc.card_number_last4
    FROM bill_payments bp
    INNER JOIN credit_cards cc ON bp.card_id = cc.id
    WHERE bp.card_id = $1 AND cc.user_id = $2
    ORDER BY bp.due_date DESC, bp.bill_date DESC`,
    [cardId, userId]
  );
  
  return result.rows;
}

/**
 * Get upcoming bills (unpaid/pending)
 */
export async function getUpcomingBills(userId: string) {
  const result = await pool.query(
    `SELECT 
      bp.*,
      cc.card_name,
      cc.bank_name,
      cc.card_number_last4
    FROM bill_payments bp
    INNER JOIN credit_cards cc ON bp.card_id = cc.id
    WHERE cc.user_id = $1 
      AND bp.payment_status IN ('pending', 'partial')
      AND bp.due_date >= CURRENT_DATE
    ORDER BY bp.due_date ASC`,
    [userId]
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
      card_id, bill_month, bill_year, bill_amount, 
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
    FROM credit_cards cc
    WHERE bp.id = $${paramCount} 
      AND bp.card_id = cc.id 
      AND cc.user_id = $${paramCount + 1}
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
    USING credit_cards cc
    WHERE bp.id = $1 
      AND bp.card_id = cc.id 
      AND cc.user_id = $2
    RETURNING bp.id`,
    [billId, userId]
  );

  return result.rows.length > 0;
}
