
import pool from '../../lib/db';
import { ClassificationRule, RuleCriteria, RuleMatchResult } from '../../types/rules.types';
import { Transaction } from '../../types/transaction.types';

export class RuleService {

    /**
     * Create a new rule
     */
    async createRule(userId: string, data: Partial<ClassificationRule>): Promise<ClassificationRule> {
        const { rows } = await pool.query(
            `INSERT INTO classification_rules (
                user_id, name, priority, is_active, criteria, action
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                userId,
                data.name,
                data.priority || 0,
                data.isActive ?? true,
                JSON.stringify(data.criteria),
                JSON.stringify(data.action)
            ]
        );
        return this.mapRule(rows[0]);
    }

    /**
     * Get user rules
     */
    async getRules(userId: string): Promise<ClassificationRule[]> {
        const { rows } = await pool.query(
            `SELECT * FROM classification_rules 
             WHERE user_id = $1 
             ORDER BY priority DESC, created_at DESC`,
            [userId]
        );
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

        values.push(ruleId, userId);
        const { rows } = await pool.query(
            `UPDATE classification_rules 
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${idx++} AND user_id = $${idx++}
             RETURNING *`,
            values
        );
        return rows[0] ? this.mapRule(rows[0]) : null;
    }

    /**
     * Delete rule
     */
    async deleteRule(userId: string, ruleId: string): Promise<boolean> {
        const { rowCount } = await pool.query(
            'DELETE FROM classification_rules WHERE id = $1 AND user_id = $2',
            [ruleId, userId]
        );
        return (rowCount || 0) > 0;
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

    private mapRule(row: any): ClassificationRule {
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
