
import { RuleRepository, RuleRow } from '@modules/rules/rules.repository';
import { ClassificationRule, RuleCriteria, RuleMatchResult } from '@shared/types/rules.types';
import { Transaction } from '@shared/types/transaction.types';

export class RuleService {

    /**
     * Create a new rule
     */
    async createRule(userId: string, data: Partial<ClassificationRule>): Promise<ClassificationRule> {
        const row = await RuleRepository.create(
            userId,
            data.name || 'Unnamed Rule',
            data.priority || 0,
            data.isActive ?? true,
            data.criteria,
            data.action
        );
        return this.mapRule(row);
    }

    /**
     * Get user rules
     */
    async getRules(userId: string): Promise<ClassificationRule[]> {
        const rows = await RuleRepository.findByUserId(userId);
        return rows.map(this.mapRule);
    }

    /**
     * Update rule
     */
    async updateRule(userId: string, ruleId: string, data: Partial<ClassificationRule>): Promise<ClassificationRule | null> {
        // Build dynamic update
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (data.name) { updates.push(`name = $${idx++}`); values.push(data.name); }
        if (data.priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(data.priority); }
        if (data.isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(data.isActive); }
        if (data.criteria) { updates.push(`criteria = $${idx++}`); values.push(JSON.stringify(data.criteria)); }
        if (data.action) { updates.push(`action = $${idx++}`); values.push(JSON.stringify(data.action)); }

        if (updates.length === 0) return null;

        const row = await RuleRepository.update(ruleId, userId, updates, values);
        return row ? this.mapRule(row) : null;
    }

    /**
     * Delete rule
     */
    async deleteRule(userId: string, ruleId: string): Promise<boolean> {
        return RuleRepository.delete(ruleId, userId);
    }

    /**
     * Evaluate transaction against rules
     */
    async evaluateTransaction(userId: string, transaction: Transaction): Promise<RuleMatchResult | null> {
        // Fetch active rules sorted by priority
        const rules = await this.getRules(userId);

        for (const rule of rules) {
            if (!rule.isActive) continue;
            if (this.matchesRule(transaction, rule.criteria)) {
                return {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    action: rule.action
                };
            }
        }
        return null;
    }

    private matchesRule(tx: Transaction, criteria: RuleCriteria): boolean {
        const txValue = this.getFieldValue(tx, criteria.field);
        if (txValue === undefined || txValue === null) return false;

        const ruleValue = criteria.value;

        switch (criteria.operator) {
            case 'equals':
                return String(txValue).toLowerCase() === String(ruleValue).toLowerCase();
            case 'contains':
                return String(txValue).toLowerCase().includes(String(ruleValue).toLowerCase());
            case 'starts_with':
                return String(txValue).toLowerCase().startsWith(String(ruleValue).toLowerCase());
            case 'ends_with':
                return String(txValue).toLowerCase().endsWith(String(ruleValue).toLowerCase());
            case 'gt':
                return Number(txValue) > Number(ruleValue);
            case 'lt':
                return Number(txValue) < Number(ruleValue);
            case 'regex':
                try {
                    return new RegExp(String(ruleValue), 'i').test(String(txValue));
                } catch (e) {
                    return false;
                }
            default:
                return false;
        }
    }

    private getFieldValue(tx: Transaction, field: string): any {
        switch (field) {
            case 'merchant': return tx.merchant;
            case 'description': return tx.description;
            case 'amount': return tx.amount;
            case 'transaction_type': return tx.transaction_type;
            default: return null;
        }
    }

    private mapRule(row: RuleRow): ClassificationRule {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            priority: row.priority,
            isActive: row.is_active,
            criteria: row.criteria, // pg auto-parses jsonb
            action: row.action,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

export const ruleService = new RuleService();
