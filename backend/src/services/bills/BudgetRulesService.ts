
/**
 * Budget Rules Service
 * Manages automation rules for budgets (e.g. Rollover, Alerts).
 */

import pool from '../../lib/db';
import logger from '../../utils/infrastructure/logger';

export interface BudgetRule {
    id: string;
    userId: string;
    name: string;
    type: 'ROLLOVER' | 'ALERT' | 'SAVINGS_SWEEP';
    config: any;
    isEnabled: boolean;
}

export class BudgetRulesService {

    /**
     * Check if user has enabled rollover
     */
    static async isRolloverEnabled(userId: string): Promise<boolean> {
        const res = await pool.query(
            `SELECT config FROM budget_rules WHERE user_id = $1 AND type = 'ROLLOVER' AND is_enabled = true`,
            [userId]
        );
        return res.rows.length > 0;
    }

    /**
     * Enable or update rollover rule
     */
    static async setRolloverRule(userId: string, enabled: boolean, percentage: number = 100) {
        if (enabled) {
            await pool.query(
                `INSERT INTO budget_rules (user_id, name, type, config, is_enabled, created_at, updated_at)
                 VALUES ($1, 'Monthly Rollover', 'ROLLOVER', $2, true, NOW(), NOW())
                 ON CONFLICT (user_id, type) WHERE (type = 'ROLLOVER')
                 DO UPDATE SET is_enabled = true, config = $2, updated_at = NOW()`,
                [userId, JSON.stringify({ percentage })]
            );
        } else {
            await pool.query(
                `UPDATE budget_rules SET is_enabled = false, updated_at = NOW() 
                 WHERE user_id = $1 AND type = 'ROLLOVER'`,
                [userId]
            );
        }
    }

    /**
     * Execute Rollover (To be called by Scheduler on 1st of month)
     * Moves unspent budget from previous month to current month's "Rollover" envelope or increases total.
     */
    static async executeRollover(userId: string, prevMonth: number, prevYear: number, currentMonth: number, currentYear: number) {
        // 1. Get previous month's status
        // This circular dependency needs to be handled carefully. 
        // We will query DB directly to avoid importing BudgetService if possible, or use dependency injection.
        // For simplicity, we assume we can calculate it here or pass it in.

        // Logic: 
        // If (Allocated - Spent) > 0:
        //    RolloverAmount = (Allocated - Spent) * (Rule.percentage / 100)
        //    Add RolloverAmount to Current Month's "Rollover" category or General Budget

        logger.info(`[BudgetRules] Executing rollover for user ${userId} from ${prevMonth}/${prevYear} to ${currentMonth}/${currentYear}`);
        // Implementation pending actual specific requirement on WHERE to put the money.
        // Usually it goes to "To be Budgeted" or a specific category.
    }
}
