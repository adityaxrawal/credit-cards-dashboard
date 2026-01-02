/**
 * Rule Repository
 * Data access layer for classification rules
 */

import { query } from '../lib/db';

export interface RuleRow {
    id: string;
    user_id: string;
    name: string;
    priority: number;
    is_active: boolean;
    criteria: any;
    action: any;
    created_at: Date;
    updated_at: Date;
}

export class RuleRepository {
    /**
     * Create a new rule
     */
    static async create(
        userId: string,
        name: string,
        priority: number,
        isActive: boolean,
        criteria: any,
        action: any
    ): Promise<RuleRow> {
        const result = await query(
            `INSERT INTO classification_rules (
                user_id, name, priority, is_active, criteria, action
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                userId,
                name,
                priority,
                isActive,
                JSON.stringify(criteria),
                JSON.stringify(action)
            ]
        );
        return result.rows[0];
    }

    /**
     * Get rules for user
     */
    static async findByUserId(userId: string): Promise<RuleRow[]> {
        const result = await query(
            `SELECT * FROM classification_rules 
             WHERE user_id = $1 
             ORDER BY priority DESC, created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Update rule with dynamic fields
     */
    static async update(
        ruleId: string,
        userId: string,
        updates: string[],
        values: any[]
    ): Promise<RuleRow | null> {
        if (updates.length === 0) return null;

        const idx = values.length + 1;
        values.push(ruleId, userId);

        const result = await query(
            `UPDATE classification_rules 
             SET ${updates.join(', ')}, updated_at = NOW()
             WHERE id = $${idx} AND user_id = $${idx + 1}
             RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }

    /**
     * Delete a rule
     */
    static async delete(ruleId: string, userId: string): Promise<boolean> {
        const result = await query(
            'DELETE FROM classification_rules WHERE id = $1 AND user_id = $2',
            [ruleId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}
