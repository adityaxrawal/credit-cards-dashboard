import pool from '@shared/database/db';

/**
 * Get all rewards for a user
 */
export async function getAllRewards(userId: string) {
  const result = await pool.query(
    `SELECT 
      rp.*,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4
    FROM reward_points rp
    INNER JOIN instruments i ON rp.instrument_id = i.id
    LEFT JOIN banks b ON i.bank_id = b.id
    WHERE i.user_id = $1 AND i.type = 'credit_card'
    ORDER BY rp.last_updated DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Get rewards for a specific card
 */
export async function getCardRewards(userId: string, cardId: string) {
  const result = await pool.query(
    `SELECT 
      rp.*,
      i.name as card_name,
      b.name as bank_name,
      i.last4 as card_number_last4
    FROM reward_points rp
    INNER JOIN instruments i ON rp.instrument_id = i.id
    LEFT JOIN banks b ON i.bank_id = b.id
    WHERE rp.instrument_id = $1 AND i.user_id = $2`,
    [cardId, userId]
  );

  return result.rows[0];
}

/**
 * Get reward transactions for a card
 */
export async function getRewardTransactions(userId: string, cardId: string) {
  const result = await pool.query(
    `SELECT 
      rt.*,
      t.merchant,
      t.amount as transaction_amount,
      t.transaction_date
    FROM reward_transactions rt
    INNER JOIN instruments i ON rt.instrument_id = i.id
    LEFT JOIN transactions t ON rt.transaction_id = t.id
    WHERE rt.instrument_id = $1 AND i.user_id = $2
    ORDER BY rt.created_at DESC`,
    [cardId, userId]
  );

  return result.rows;
}

/**
 * Get rewards summary for a user
 */
export async function getRewardsSummary(userId: string) {
  const result = await pool.query(
    `SELECT 
      SUM(rp.points_earned) as total_points_earned,
      SUM(rp.points_redeemed) as total_points_redeemed,
      SUM(rp.points_balance) as total_points_balance,
      SUM(rp.points_expiring_soon) as total_points_expiring_soon,
      COUNT(DISTINCT rp.instrument_id) as cards_with_rewards
    FROM reward_points rp
    INNER JOIN instruments i ON rp.instrument_id = i.id
    WHERE i.user_id = $1 AND i.type = 'credit_card'`,
    [userId]
  );

  return result.rows[0];
}

/**
 * Create or update reward points for a card
 */
export async function upsertRewardPoints(data: {
  cardId: string;
  pointsEarned: number;
  pointsRedeemed: number;
  pointsBalance: number;
  pointsExpiringSoon?: number;
  nextExpiryDate?: Date;
}) {
  const result = await pool.query(
    `INSERT INTO reward_points (
      instrument_id, points_earned, points_redeemed, points_balance,
      points_expiring_soon, next_expiry_date, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (instrument_id) 
    DO UPDATE SET
      points_earned = EXCLUDED.points_earned,
      points_redeemed = EXCLUDED.points_redeemed,
      points_balance = EXCLUDED.points_balance,
      points_expiring_soon = EXCLUDED.points_expiring_soon,
      next_expiry_date = EXCLUDED.next_expiry_date,
      last_updated = NOW()
    RETURNING *`,
    [
      data.cardId,
      data.pointsEarned,
      data.pointsRedeemed,
      data.pointsBalance,
      data.pointsExpiringSoon || 0,
      data.nextExpiryDate || null,
    ]
  );

  return result.rows[0];
}

/**
 * Create a reward transaction
 */
export async function createRewardTransaction(data: {
  cardId: string;
  transactionId?: string;
  pointsChange: number;
  description?: string;
  expiryDate?: Date;
}) {
  const result = await pool.query(
    `INSERT INTO reward_transactions (
      instrument_id, transaction_id, points_change, description, expiry_date
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      data.cardId,
      data.transactionId || null,
      data.pointsChange,
      data.description || null,
      data.expiryDate || null,
    ]
  );

  return result.rows[0];
}
