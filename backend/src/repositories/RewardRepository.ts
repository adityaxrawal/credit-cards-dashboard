/**
 * Reward Repository
 * Data access layer for reward rules and calculations
 */

import { query } from '../lib/db';

export class RewardRepository {
    /**
     * Get all reward rules for user
     */
    static async getRules(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT * FROM reward_rules 
             WHERE user_id = $1 AND is_active = true
             ORDER BY priority DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get matching rules for a transaction
     */
    /**
     * Get matching rules for a transaction
     */
    static async getMatchingRules(
        userId: string,
        filters: {
            instrumentId?: string;
            cardId?: string;
            bankId?: string;
            category?: string;
            merchant?: string;
            amount?: number;
            transactionType?: string;
        }
    ): Promise<any[]> {
        const queryStr = `
            SELECT * FROM reward_rules 
            WHERE user_id = $1 
              AND is_active = true
              AND (start_date IS NULL OR start_date <= CURRENT_DATE)
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
              AND (instrument_id IS NULL OR instrument_id = $2)
              AND (card_id IS NULL OR card_id = $3::uuid)
              AND (bank_id IS NULL OR bank_id = $4)
              AND (category IS NULL OR category = $5)
              AND (transaction_type IS NULL OR transaction_type = $6)
              AND ($7::numeric IS NULL OR min_amount IS NULL OR $7 >= min_amount)
              AND ($7::numeric IS NULL OR max_amount IS NULL OR $7 <= max_amount)
              AND (
                  merchant_pattern IS NULL 
                  OR $8::text IS NULL
                  OR (
                      CASE 
                          WHEN merchant_pattern LIKE '%*%' THEN $8 ILIKE REPLACE(merchant_pattern, '*', '%')
                          ELSE $8 ILIKE '%' || merchant_pattern || '%'
                      END
                  )
              )
            ORDER BY priority DESC`;

        const result = await query(queryStr, [
            userId,
            filters.instrumentId,
            filters.cardId,
            filters.bankId,
            filters.category,
            filters.transactionType,
            filters.amount,
            filters.merchant
        ]);
        return result.rows;
    }

    /**
     * Get monthly rewards used for a rule
     */
    static async getMonthlyRewardsUsed(userId: string, ruleId: string): Promise<number> {
        const result = await query(
            `SELECT COALESCE(SUM(reward_amount), 0) as total
             FROM reward_transactions
             WHERE user_id = $1 
               AND rule_id = $2
               AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
               AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`,
            [userId, ruleId]
        );
        return parseFloat(result.rows[0]?.total || '0');
    }

    /**
     * Record reward transaction
     */
    /**
     * Record reward transaction and update balance
     */
    static async recordReward(
        userId: string,
        transactionId: string,
        ruleId: string,
        ruleName: string,
        rewardType: string,
        rewardAmount: number,
        rateApplied: number,
        rateType: string
    ): Promise<void> {
        // We really should use a transaction here, but for now we'll do sequentially
        // 1. Insert reward transaction
        await query(
            `INSERT INTO reward_transactions (
                user_id, transaction_id, rule_id, rule_name, 
                reward_type, reward_amount, rate_applied, rate_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT DO NOTHING`,
            [userId, transactionId, ruleId, ruleName, rewardType, rewardAmount, rateApplied, rateType]
        );

        // 2. Update total rewards
        await query(
            `INSERT INTO reward_points (user_id, total_points, last_updated)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) 
             DO UPDATE SET 
                total_points = reward_points.total_points + $2,
                last_updated = NOW()`,
            [userId, rewardAmount]
        );
    }

    /**
     * Create a reward rule
     */
    static async createRule(userId: string, rule: {
        ruleName: string;
        instrumentId?: string;
        category?: string;
        merchantPattern?: string;
        minAmount?: number;
        maxAmount?: number;
        rewardType: string;
        rate: number;
        rateType: string;
        maxRewardPerTransaction?: number;
        maxRewardPerMonth?: number;
        priority?: number;
    }): Promise<any> {
        const result = await query(
            `INSERT INTO reward_rules (
                user_id, rule_name, instrument_id, category, merchant_pattern,
                min_amount, max_amount, reward_type, rate, rate_type,
                max_reward_per_transaction, max_reward_per_month, priority, is_active, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, NOW())
            RETURNING *`,
            [
                userId, rule.ruleName, rule.instrumentId, rule.category, rule.merchantPattern,
                rule.minAmount, rule.maxAmount, rule.rewardType, rule.rate, rule.rateType,
                rule.maxRewardPerTransaction, rule.maxRewardPerMonth, rule.priority || 0,
            ]
        );
        return result.rows[0];
    }

    /**
     * Delete a rule
     */
    static async deleteRule(userId: string, ruleId: string): Promise<boolean> {
        const result = await query(
            `DELETE FROM reward_rules WHERE id = $1 AND user_id = $2`,
            [ruleId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Toggle rule active status
     */
    static async toggleRule(userId: string, ruleId: string, isActive: boolean): Promise<boolean> {
        const result = await query(
            `UPDATE reward_rules SET is_active = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2`,
            [ruleId, userId, isActive]
        );
        return (result.rowCount ?? 0) > 0;
    }
}
