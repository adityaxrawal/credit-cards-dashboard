/**
 * Budget Rules Repository
 * Data access layer for budget automation rules
 */

import { query } from '../lib/db';

export interface BudgetRuleRow {
    id: string;
    user_id: string;
    name: string;
    type: string;
    config: any;
    is_enabled: boolean;
    created_at: Date;
    updated_at: Date;
}

export class BudgetRulesRepository {
    /**
     * Check if rollover is enabled for user
     */
    static async isRolloverEnabled(userId: string): Promise<boolean> {
        const result = await query(
            `SELECT config FROM budget_rules WHERE user_id = $1 AND type = 'ROLLOVER' AND is_enabled = true`,
            [userId]
        );
        return result.rows.length > 0;
    }

    /**
     * Enable/update rollover rule
     */
    static async upsertRolloverRule(userId: string, percentage: number): Promise<void> {
        await query(
            `INSERT INTO budget_rules (user_id, name, type, config, is_enabled, created_at, updated_at)
             VALUES ($1, 'Monthly Rollover', 'ROLLOVER', $2, true, NOW(), NOW())
             ON CONFLICT (user_id, type) WHERE (type = 'ROLLOVER')
             DO UPDATE SET is_enabled = true, config = $2, updated_at = NOW()`,
            [userId, JSON.stringify({ percentage })]
        );
    }

    /**
     * Disable rollover rule
     */
    static async disableRolloverRule(userId: string): Promise<void> {
        await query(
            `UPDATE budget_rules SET is_enabled = false, updated_at = NOW() 
             WHERE user_id = $1 AND type = 'ROLLOVER'`,
            [userId]
        );
    }

    /**
     * Get rule by type
     */
    static async getRuleByType(userId: string, type: string): Promise<BudgetRuleRow | null> {
        const result = await query(
            `SELECT * FROM budget_rules WHERE user_id = $1 AND type = $2`,
            [userId, type]
        );
        return result.rows[0] || null;
    }
}
