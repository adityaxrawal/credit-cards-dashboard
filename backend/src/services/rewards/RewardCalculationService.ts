/**
 * Reward Calculation Service
 * Auto-calculates reward points/cashback based on configured rules
 */

import { RewardRepository } from '../../repositories/RewardRepository';
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
            bankId?: string; // Added to interface if available
        }
    ): Promise<RewardRule[]> {
        const rules = await RewardRepository.getMatchingRules(userId, {
            instrumentId: transaction.instrumentId,
            cardId: transaction.cardId,
            bankId: transaction.bankId,
            category: transaction.category,
            merchant: transaction.merchant,
            amount: transaction.amount,
            transactionType: transaction.transactionType
        });

        // Map snake_case Repo result to camelCase RewardRule interface
        return rules.map(r => ({
            id: r.id,
            userId: r.user_id,
            cardId: r.card_id,
            instrumentId: r.instrument_id,
            bankId: r.bank_id,
            category: r.category,
            merchantPattern: r.merchant_pattern,
            minAmount: r.min_amount ? parseFloat(r.min_amount) : null,
            maxAmount: r.max_amount ? parseFloat(r.max_amount) : null,
            transactionType: r.transaction_type,
            rewardType: r.reward_type,
            rate: parseFloat(r.rate),
            rateType: r.rate_type,
            maxRewardPerTransaction: r.max_reward_per_transaction ? parseFloat(r.max_reward_per_transaction) : null,
            maxRewardPerMonth: r.max_reward_per_month ? parseFloat(r.max_reward_per_month) : null,
            ruleName: r.rule_name,
            priority: r.priority,
            isActive: r.is_active
        }));
    }

    /**
     * Get total rewards earned for a rule this month
     */
    private static async getMonthlyRewardsUsed(
        userId: string,
        ruleId: string
    ): Promise<number> {
        return RewardRepository.getMonthlyRewardsUsed(userId, ruleId);
    }

    /**
     * Record a reward transaction
     */
    static async recordReward(
        userId: string,
        transactionId: string,
        reward: CalculatedReward
    ): Promise<void> {
        await RewardRepository.recordReward(
            userId,
            transactionId,
            reward.ruleId,
            reward.ruleName,
            reward.rewardType,
            reward.rewardAmount,
            reward.rateApplied,
            reward.rateType
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
        const rules = await RewardRepository.getRules(userId);
        return rules.map(r => ({
            id: r.id,
            userId: r.user_id,
            cardId: r.card_id,
            instrumentId: r.instrument_id,
            bankId: r.bank_id,
            category: r.category,
            merchantPattern: r.merchant_pattern,
            minAmount: r.min_amount ? parseFloat(r.min_amount) : null,
            maxAmount: r.max_amount ? parseFloat(r.max_amount) : null,
            transactionType: r.transaction_type,
            rewardType: r.reward_type,
            rate: parseFloat(r.rate),
            rateType: r.rate_type,
            maxRewardPerTransaction: r.max_reward_per_transaction ? parseFloat(r.max_reward_per_transaction) : null,
            maxRewardPerMonth: r.max_reward_per_month ? parseFloat(r.max_reward_per_month) : null,
            ruleName: r.rule_name,
            priority: r.priority,
            isActive: r.is_active
        }));
    }

    /**
     * Create a new reward rule
     */
    static async createRule(
        userId: string,
        rule: Partial<RewardRule>
    ): Promise<RewardRule> {
        const r = await RewardRepository.createRule(userId, {
            ruleName: rule.ruleName || 'Default Rule',
            instrumentId: rule.instrumentId || undefined,
            category: rule.category || undefined,
            merchantPattern: rule.merchantPattern || undefined,
            minAmount: rule.minAmount || undefined,
            maxAmount: rule.maxAmount || undefined,
            rewardType: rule.rewardType || 'points',
            rate: rule.rate || 1,
            rateType: rule.rateType || 'multiplier',
            maxRewardPerTransaction: rule.maxRewardPerTransaction || undefined,
            maxRewardPerMonth: rule.maxRewardPerMonth || undefined,
            priority: rule.priority || 0
        });

        // Map back to camelCase
        return {
            id: r.id,
            userId: r.user_id,
            cardId: r.card_id,
            instrumentId: r.instrument_id,
            bankId: r.bank_id,
            category: r.category,
            merchantPattern: r.merchant_pattern,
            minAmount: r.min_amount ? parseFloat(r.min_amount) : null,
            maxAmount: r.max_amount ? parseFloat(r.max_amount) : null,
            transactionType: r.transaction_type,
            rewardType: r.reward_type,
            rate: parseFloat(r.rate),
            rateType: r.rate_type,
            maxRewardPerTransaction: r.max_reward_per_transaction ? parseFloat(r.max_reward_per_transaction) : null,
            maxRewardPerMonth: r.max_reward_per_month ? parseFloat(r.max_reward_per_month) : null,
            ruleName: r.rule_name,
            priority: r.priority,
            isActive: r.is_active
        };
    }

    /**
     * Delete a rule
     */
    static async deleteRule(
        userId: string,
        ruleId: string
    ): Promise<boolean> {
        return RewardRepository.deleteRule(userId, ruleId);
    }

    /**
     * Toggle rule active status
     */
    static async toggleRule(
        userId: string,
        ruleId: string,
        isActive: boolean
    ): Promise<boolean> {
        return RewardRepository.toggleRule(userId, ruleId, isActive);
    }
}
