/**
 * Goals Repository
 * Data access layer for savings goals and contributions
 */

import { query } from '@shared/database/db';

export interface GoalRow {
    id: string;
    user_id: string;
    linked_account_id: string | null;
    goal_name: string;
    goal_type: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    target_amount: number;
    current_amount: number;
    currency: string;
    target_date: string | null;
    start_date: string;
    contribution_frequency: string | null;
    contribution_amount: number | null;
    next_contribution_date: string | null;
    progress_percent: number;
    status: string;
    completed_at: Date | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
}

export interface ContributionRow {
    id: string;
    goal_id: string;
    amount: number;
    contribution_date: string;
    contribution_type: string;
    source_account_id: string | null;
    balance_after: number;
    notes: string | null;
    created_at: Date;
}

export class GoalsRepository {
    /**
     * Get all goals for user
     */
    static async findAll(userId: string, filters: { status?: string; type?: string } = {}): Promise<GoalRow[]> {
        let sql = `SELECT * FROM goals WHERE user_id = $1`;
        const params: any[] = [userId];
        let idx = 2;

        if (filters.status) {
            sql += ` AND status = $${idx++}`;
            params.push(filters.status);
        }
        if (filters.type) {
            sql += ` AND goal_type = $${idx++}`;
            params.push(filters.type);
        }

        sql += ` ORDER BY created_at DESC`;
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get goal by ID
     */
    static async findById(userId: string, goalId: string): Promise<GoalRow | null> {
        const result = await query(
            `SELECT * FROM goals WHERE id = $1 AND user_id = $2`,
            [goalId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new goal
     */
    static async create(data: {
        userId: string;
        goalName: string;
        goalType: string;
        description?: string;
        icon?: string;
        color?: string;
        targetAmount: number;
        currentAmount?: number;
        currency?: string;
        targetDate?: string;
        startDate: string;
        contributionFrequency?: string;
        contributionAmount?: number;
        nextContributionDate?: string;
        linkedAccountId?: string;
        metadata?: any;
    }): Promise<GoalRow> {
        const currentAmount = data.currentAmount || 0;
        const progressPercent = (currentAmount / data.targetAmount) * 100;

        const result = await query(
            `INSERT INTO goals (
                user_id, goal_name, goal_type, description, icon, color,
                target_amount, current_amount, currency, target_date,
                start_date, contribution_frequency, contribution_amount,
                next_contribution_date, linked_account_id, progress_percent,
                status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active', $17)
            RETURNING *`,
            [
                data.userId,
                data.goalName,
                data.goalType,
                data.description || null,
                data.icon || null,
                data.color || null,
                data.targetAmount,
                currentAmount,
                data.currency || 'INR',
                data.targetDate || null,
                data.startDate,
                data.contributionFrequency || null,
                data.contributionAmount || null,
                data.nextContributionDate || null,
                data.linkedAccountId || null,
                progressPercent,
                data.metadata ? JSON.stringify(data.metadata) : null,
            ]
        );
        return result.rows[0];
    }

    /**
     * Update a goal with dynamic fields
     */
    static async update(goalId: string, userId: string, setClauses: string[], params: any[]): Promise<GoalRow | null> {
        if (setClauses.length === 0) return null;

        const result = await query(
            `UPDATE goals SET ${setClauses.join(', ')}, updated_at = NOW()
             WHERE id = $${params.length + 1} AND user_id = $${params.length + 2}
             RETURNING *`,
            [...params, goalId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Delete a goal
     */
    static async delete(goalId: string, userId: string): Promise<void> {
        await query(
            `DELETE FROM goals WHERE id = $1 AND user_id = $2`,
            [goalId, userId]
        );
    }

    /**
     * Add contribution to a goal
     */
    static async addContribution(data: {
        goalId: string;
        amount: number;
        contributionDate: string;
        contributionType: string;
        sourceAccountId?: string;
        balanceAfter: number;
        notes?: string;
    }): Promise<ContributionRow> {
        const result = await query(
            `INSERT INTO goal_contributions (
                goal_id, amount, contribution_date, contribution_type,
                source_account_id, balance_after, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                data.goalId,
                data.amount,
                data.contributionDate,
                data.contributionType,
                data.sourceAccountId || null,
                data.balanceAfter,
                data.notes || null,
            ]
        );
        return result.rows[0];
    }

    /**
     * Update goal after contribution
     */
    static async updateAfterContribution(
        goalId: string,
        userId: string,
        newCurrentAmount: number,
        progressPercent: number,
        status: string,
        completedAt: Date | null
    ): Promise<GoalRow | null> {
        const result = await query(
            `UPDATE goals SET 
                current_amount = $3, 
                progress_percent = $4, 
                status = $5,
                completed_at = $6,
                updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [goalId, userId, newCurrentAmount, progressPercent, status, completedAt]
        );
        return result.rows[0] || null;
    }

    /**
     * Get contributions for a goal
     */
    static async getContributions(goalId: string): Promise<ContributionRow[]> {
        const result = await query(
            `SELECT * FROM goal_contributions WHERE goal_id = $1 ORDER BY contribution_date DESC`,
            [goalId]
        );
        return result.rows;
    }

    /**
     * Get recent contributions for a goal
     */
    static async getRecentContributions(goalId: string, limit: number = 5): Promise<ContributionRow[]> {
        const result = await query(
            `SELECT * FROM goal_contributions WHERE goal_id = $1 ORDER BY contribution_date DESC LIMIT $2`,
            [goalId, limit]
        );
        return result.rows;
    }

    /**
     * Get goals summary
     */
    static async getSummary(userId: string): Promise<any> {
        const result = await query(
            `SELECT 
                status,
                COUNT(*) as count,
                SUM(target_amount) as target_amount,
                SUM(current_amount) as current_amount
             FROM goals WHERE user_id = $1
             GROUP BY status`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get upcoming milestones (goals near completion)
     */
    static async getUpcomingMilestones(userId: string, limit: number = 5): Promise<GoalRow[]> {
        const result = await query(
            `SELECT * FROM goals 
             WHERE user_id = $1 AND status = 'active' AND progress_percent >= 70
             ORDER BY progress_percent DESC
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }
}
