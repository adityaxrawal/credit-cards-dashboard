import { query } from '../lib/db';

export class RewardRepository {
  static async getAllRewards(userId: string) {
    const result = await query(
      `SELECT 
        rp.*,
        cc.card_name,
        cc.bank_name,
        cc.card_number_last4
      FROM reward_points rp
      INNER JOIN credit_cards cc ON rp.card_id = cc.id
      WHERE cc.user_id = $1
      ORDER BY rp.last_updated DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getCardRewards(userId: string, cardId: string) {
    const result = await query(
      `SELECT 
        rp.*,
        cc.card_name,
        cc.bank_name,
        cc.card_number_last4
      FROM reward_points rp
      INNER JOIN credit_cards cc ON rp.card_id = cc.id
      WHERE rp.card_id = $1 AND cc.user_id = $2`,
      [cardId, userId]
    );
    return result.rows[0];
  }

  static async getRewardTransactions(userId: string, cardId: string) {
    const result = await query(
      `SELECT 
        rt.*,
        t.merchant,
        t.amount as transaction_amount,
        t.transaction_date
      FROM reward_transactions rt
      INNER JOIN credit_cards cc ON rt.card_id = cc.id
      LEFT JOIN transactions t ON rt.transaction_id = t.id
      WHERE rt.card_id = $1 AND cc.user_id = $2
      ORDER BY rt.created_at DESC`,
      [cardId, userId]
    );
    return result.rows;
  }

  static async getRewardsSummary(userId: string) {
    const result = await query(
      `SELECT 
        SUM(rp.points_earned) as total_points_earned,
        SUM(rp.points_redeemed) as total_points_redeemed,
        SUM(rp.points_balance) as total_points_balance,
        SUM(rp.points_expiring_soon) as total_points_expiring_soon,
        COUNT(DISTINCT rp.card_id) as cards_with_rewards
      FROM reward_points rp
      INNER JOIN credit_cards cc ON rp.card_id = cc.id
      WHERE cc.user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  static async upsertRewardPoints(data: {
    cardId: string;
    pointsEarned: number;
    pointsRedeemed: number;
    pointsBalance: number;
    pointsExpiringSoon?: number;
    nextExpiryDate?: Date;
  }) {
    const result = await query(
      `INSERT INTO reward_points (
        card_id, points_earned, points_redeemed, points_balance,
        points_expiring_soon, next_expiry_date, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (card_id) 
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

  static async createRewardTransaction(data: {
    cardId: string;
    transactionId?: string;
    pointsChange: number;
    description?: string;
    expiryDate?: Date;
  }) {
    const result = await query(
      `INSERT INTO reward_transactions (
        card_id, transaction_id, points_change, description, expiry_date
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
}
