/**
 * Reward Calculation Service
 * Auto-calculates reward points/cashback based on configured rules
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

export interface RewardRule {
    id: string;
    userId: string;
    cardId: string | null;
    instrumentId: string | null;
    bankId: string | null;
    category: string | null;
    merchantPattern: string | null;
    minAmount: number | null;
    maxAmount: number | null;
    transactionType: string | null;
    rewardType: 'points' | 'cashback' | 'miles';
    rate: number;
    rateType: 'percentage' | 'multiplier' | 'fixed';
    maxRewardPerTransaction: number | null;
    maxRewardPerMonth: number | null;
    ruleName: string;
    priority: number;
    isActive: boolean;
}

export interface CalculatedReward {
    ruleId: string;
    ruleName: string;
    rewardType: 'points' | 'cashback' | 'miles';
    rewardAmount: number;
    rateApplied: number;
    rateType: string;
}

export class RewardCalculationService {
    /**
     * Calculate rewards for a transaction
     */
    static async calculateReward(
        userId: string,
        transaction: {
            amount: number;
            category?: string;
            merchant?: string;
            instrumentId?: string;
            cardId?: string;
            transactionType?: string;
        }
    ): Promise<CalculatedReward | null> {
        // Get all active rules for this user, ordered by priority
        const rules = await this.getMatchingRules(userId, transaction);

        if (rules.length === 0) {
            return null;
        }

        // Use the highest priority matching rule
        const rule = rules[0];

        // Calculate reward based on rule
        let rewardAmount = 0;

        switch (rule.rateType) {
            case 'percentage':
                rewardAmount = transaction.amount * (rule.rate / 100);
                break;
            case 'multiplier':
                // Base points calculation: 1 point per 100 rupees, then multiply
                rewardAmount = Math.floor(transaction.amount / 100) * rule.rate;
                break;
            case 'fixed':
                rewardAmount = rule.rate;
                break;
        }

        // Apply per-transaction cap
        if (rule.maxRewardPerTransaction && rewardAmount > rule.maxRewardPerTransaction) {
            rewardAmount = rule.maxRewardPerTransaction;
        }

        // Check monthly cap
        if (rule.maxRewardPerMonth) {
            const monthlyUsed = await this.getMonthlyRewardsUsed(userId, rule.id);
            const remaining = rule.maxRewardPerMonth - monthlyUsed;
            if (rewardAmount > remaining) {
                rewardAmount = Math.max(0, remaining);
            }
        }

        return {
            ruleId: rule.id,
            ruleName: rule.ruleName,
            rewardType: rule.rewardType,
            rewardAmount,
            rateApplied: rule.rate,
            rateType: rule.rateType,
        };
    }

    /**
     * Get matching rules for a transaction, sorted by priority
     */
    private static async getMatchingRules(
        userId: string,
        transaction: {
            amount: number;
            category?: string;
            merchant?: string;
            instrumentId?: string;
            cardId?: string;
            transactionType?: string;
        }
    ): Promise<RewardRule[]> {
        const query = `
            SELECT 
                id, user_id as "userId", card_id as "cardId",
                instrument_id as "instrumentId", bank_id as "bankId",
                category, merchant_pattern as "merchantPattern",
                min_amount as "minAmount", max_amount as "maxAmount",
                transaction_type as "transactionType",
                reward_type as "rewardType", rate, rate_type as "rateType",
                max_reward_per_transaction as "maxRewardPerTransaction",
                max_reward_per_month as "maxRewardPerMonth",
                rule_name as "ruleName", priority, is_active as "isActive"
            FROM reward_rules
            WHERE user_id = $1
              AND is_active = true
              AND (start_date IS NULL OR start_date <= CURRENT_DATE)
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
              AND (card_id IS NULL OR card_id = $2::uuid)
              AND (instrument_id IS NULL OR instrument_id = $3::uuid)
              AND (category IS NULL OR category = $4)
              AND (min_amount IS NULL OR $5 >= min_amount)
              AND (max_amount IS NULL OR $5 <= max_amount)
              AND (transaction_type IS NULL OR transaction_type = $6)
            ORDER BY priority DESC
            LIMIT 10
        `;

        const result = await pool.query(query, [
            userId,
            transaction.cardId || null,
            transaction.instrumentId || null,
            transaction.category || null,
            transaction.amount,
            transaction.transactionType || null,
        ]);

        // Filter by merchant pattern if present
        return result.rows.filter(rule => {
            if (!rule.merchantPattern) return true;
            if (!transaction.merchant) return false;

            const pattern = rule.merchantPattern.toLowerCase();
            const merchant = transaction.merchant.toLowerCase();

            // Simple pattern matching (supports wildcards)
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(merchant);
            }
            return merchant.includes(pattern);
        });
    }

    /**
     * Get total rewards earned for a rule this month
     */
    private static async getMonthlyRewardsUsed(
        userId: string,
        ruleId: string
    ): Promise<number> {
        const result = await pool.query(
            `SELECT COALESCE(SUM(points_earned), 0) as total
             FROM reward_transactions
             WHERE user_id = $1 
               AND rule_id = $2
               AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)`,
            [userId, ruleId]
        );

        return parseFloat(result.rows[0]?.total || '0');
    }

    /**
     * Record a reward transaction
     */
    static async recordReward(
        userId: string,
        transactionId: string,
        reward: CalculatedReward
    ): Promise<void> {
        // Get or create card reward balance
        await pool.query(
            `INSERT INTO reward_transactions (
                user_id, transaction_id, rule_id, 
                points_earned, reward_type, rate_applied
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING`,
            [
                userId,
                transactionId,
                reward.ruleId,
                reward.rewardAmount,
                reward.rewardType,
                reward.rateApplied,
            ]
        );

        // Update total rewards in reward_points if it exists
        await pool.query(
            `UPDATE reward_points 
             SET total_points = total_points + $2,
                 last_updated = NOW()
             WHERE user_id = $1`,
            [userId, reward.rewardAmount]
        );

        logger.info('reward_recorded', {
            userId,
            transactionId,
            rewardAmount: reward.rewardAmount,
            rewardType: reward.rewardType,
        });
    }

    /**
     * Get all rules for a user
     */
    static async getRules(userId: string): Promise<RewardRule[]> {
        const result = await pool.query(
            `SELECT 
                id, user_id as "userId", card_id as "cardId",
                instrument_id as "instrumentId", bank_id as "bankId",
                category, merchant_pattern as "merchantPattern",
                min_amount as "minAmount", max_amount as "maxAmount",
                transaction_type as "transactionType",
                reward_type as "rewardType", rate, rate_type as "rateType",
                max_reward_per_transaction as "maxRewardPerTransaction",
                max_reward_per_month as "maxRewardPerMonth",
                rule_name as "ruleName", priority, is_active as "isActive"
            FROM reward_rules
            WHERE user_id = $1
            ORDER BY priority DESC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Create a new reward rule
     */
    static async createRule(
        userId: string,
        rule: Partial<RewardRule>
    ): Promise<RewardRule> {
        const result = await pool.query(
            `INSERT INTO reward_rules (
                user_id, card_id, instrument_id, bank_id,
                category, merchant_pattern, min_amount, max_amount,
                transaction_type, reward_type, rate, rate_type,
                max_reward_per_transaction, max_reward_per_month,
                rule_name, priority
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *`,
            [
                userId,
                rule.cardId || null,
                rule.instrumentId || null,
                rule.bankId || null,
                rule.category || null,
                rule.merchantPattern || null,
                rule.minAmount || null,
                rule.maxAmount || null,
                rule.transactionType || null,
                rule.rewardType || 'points',
                rule.rate || 1,
                rule.rateType || 'multiplier',
                rule.maxRewardPerTransaction || null,
                rule.maxRewardPerMonth || null,
                rule.ruleName || 'Default Rule',
                rule.priority || 0,
            ]
        );

        return result.rows[0];
    }

    /**
     * Delete a rule
     */
    static async deleteRule(
        userId: string,
        ruleId: string
    ): Promise<boolean> {
        const result = await pool.query(
            `DELETE FROM reward_rules WHERE id = $1 AND user_id = $2 RETURNING id`,
            [ruleId, userId]
        );

        return (result.rowCount ?? 0) > 0;
    }

    /**
     * Toggle rule active status
     */
    static async toggleRule(
        userId: string,
        ruleId: string,
        isActive: boolean
    ): Promise<boolean> {
        const result = await pool.query(
            `UPDATE reward_rules SET is_active = $3, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [ruleId, userId, isActive]
        );

        return (result.rowCount ?? 0) > 0;
    }
}
