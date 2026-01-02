
/**
 * Budget Rules Service
 * Manages automation rules for budgets (e.g. Rollover, Alerts).
 */

import { BudgetRulesRepository } from '../../repositories/BudgetRulesRepository';
import logger from '@shared/utils/infrastructure/logger';

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
        return BudgetRulesRepository.isRolloverEnabled(userId);
    }

    /**
     * Enable or update rollover rule
     */
    static async setRolloverRule(userId: string, enabled: boolean, percentage: number = 100) {
        if (enabled) {
            await BudgetRulesRepository.upsertRolloverRule(userId, percentage);
        } else {
            await BudgetRulesRepository.disableRolloverRule(userId);
        }
    }

    /**
     * Execute Rollover (To be called by Scheduler on 1st of month)
     * Moves unspent budget from previous month to current month's "Rollover" envelope or increases total.
     */
    static async executeRollover(userId: string, prevMonth: number, prevYear: number, currentMonth: number, currentYear: number) {
        // Logic: 
        // If (Allocated - Spent) > 0:
        //    RolloverAmount = (Allocated - Spent) * (Rule.percentage / 100)
        //    Add RolloverAmount to Current Month's "Rollover" category or General Budget

        logger.info(`[BudgetRules] Executing rollover for user ${userId} from ${prevMonth}/${prevYear} to ${currentMonth}/${currentYear}`);
        // Implementation pending actual specific requirement on WHERE to put the money.
        // Usually it goes to "To be Budgeted" or a specific category.
    }
}
