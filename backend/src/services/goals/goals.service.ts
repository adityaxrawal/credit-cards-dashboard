import pool from '../../lib/db';
import { addMonths, differenceInDays, format } from 'date-fns';

export interface GoalInput {
    goalName: string;
    goalType: string;
    description?: string;
    icon?: string;
    color?: string;
    targetAmount: number;
    currentAmount?: number;
    currency?: string;
    targetDate?: string;
    contributionFrequency?: string;
    contributionAmount?: number;
    linkedAccountId?: string;
    metadata?: Record<string, unknown>;
}

export interface Goal {
    id: string;
    userId: string;
    linkedAccountId?: string;
    goalName: string;
    goalType: string;
    description?: string;
    icon?: string;
    color?: string;
    targetAmount: number;
    currentAmount: number;
    currency: string;
    targetDate?: string;
    startDate: string;
    contributionFrequency?: string;
    contributionAmount?: number;
    nextContributionDate?: string;
    progressPercent: number;
    status: string;
    completedAt?: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContributionInput {
    amount: number;
    contributionDate?: string;
    contributionType?: 'manual' | 'scheduled' | 'interest' | 'bonus' | 'withdrawal';
    sourceAccountId?: string;
    notes?: string;
}

export interface Contribution {
    id: string;
    goalId: string;
    amount: number;
    contributionDate: string;
    contributionType: string;
    sourceAccountId?: string;
    balanceAfter: number;
    notes?: string;
    createdAt: Date;
}

export interface GoalProgress {
    goal: Goal;
    daysRemaining?: number;
    amountRemaining: number;
    onTrack: boolean;
    projectedCompletion?: string;
    suggestedMonthlyContribution?: number;
    recentContributions: Contribution[];
}

export interface GoalsSummary {
    totalGoals: number;
    activeGoals: number;
    completedGoals: number;
    totalTargetAmount: number;
    totalCurrentAmount: number;
    overallProgress: number;
    byType: Record<string, { count: number; targetAmount: number; currentAmount: number }>;
    upcomingMilestones: Array<{
        goalId: string;
        goalName: string;
        progressPercent: number;
        targetDate?: string;
    }>;
}

export class GoalsService {
    /**
     * Get all goals for a user
     */
    async getAll(
        userId: string,
        filters: { status?: string; type?: string } = {}
    ): Promise<Goal[]> {
        let query = `SELECT * FROM goals WHERE user_id = $1`;
        const params: unknown[] = [userId];
        let paramIndex = 2;

        if (filters.status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(filters.status);
        }

        if (filters.type) {
            query += ` AND goal_type = $${paramIndex++}`;
            params.push(filters.type);
        }

        query += ` ORDER BY 
      CASE WHEN status = 'active' THEN 0 ELSE 1 END,
      progress_percent DESC, 
      target_date ASC NULLS LAST`;

        const result = await pool.query(query, params);
        return result.rows.map(this.mapToGoal);
    }

    /**
     * Get goal by ID
     */
    async getById(userId: string, goalId: string): Promise<Goal | null> {
        const query = `SELECT * FROM goals WHERE id = $1 AND user_id = $2`;
        const result = await pool.query(query, [goalId, userId]);

        if (result.rows.length === 0) return null;
        return this.mapToGoal(result.rows[0]);
    }

    /**
     * Create a new goal
     */
    async create(userId: string, input: GoalInput): Promise<Goal> {
        // Calculate next contribution date
        let nextContributionDate: string | null = null;
        if (input.contributionFrequency && input.contributionAmount) {
            const today = new Date();
            switch (input.contributionFrequency) {
                case 'daily':
                    nextContributionDate = format(new Date(today.getTime() + 86400000), 'yyyy-MM-dd');
                    break;
                case 'weekly':
                    nextContributionDate = format(new Date(today.getTime() + 7 * 86400000), 'yyyy-MM-dd');
                    break;
                case 'monthly':
                    nextContributionDate = format(addMonths(today, 1), 'yyyy-MM-dd');
                    break;
                case 'quarterly':
                    nextContributionDate = format(addMonths(today, 3), 'yyyy-MM-dd');
                    break;
                case 'yearly':
                    nextContributionDate = format(addMonths(today, 12), 'yyyy-MM-dd');
                    break;
            }
        }

        const query = `
      INSERT INTO goals (
        user_id, linked_account_id, goal_name, goal_type, description,
        icon, color, target_amount, current_amount, currency,
        target_date, contribution_frequency, contribution_amount,
        next_contribution_date, metadata, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active'
      )
      RETURNING *
    `;
        const result = await pool.query(query, [
            userId,
            input.linkedAccountId || null,
            input.goalName,
            input.goalType,
            input.description || null,
            input.icon || null,
            input.color || null,
            input.targetAmount,
            input.currentAmount || 0,
            input.currency || 'INR',
            input.targetDate || null,
            input.contributionFrequency || null,
            input.contributionAmount || null,
            nextContributionDate,
            JSON.stringify(input.metadata || {}),
        ]);

        // If initial amount provided, create contribution record
        if (input.currentAmount && input.currentAmount > 0) {
            await this.addContribution(userId, result.rows[0].id, {
                amount: input.currentAmount,
                contributionType: 'manual',
                notes: 'Initial contribution',
            });
        }

        return this.mapToGoal(result.rows[0]);
    }

    /**
     * Update a goal
     */
    async update(
        userId: string,
        goalId: string,
        input: Partial<GoalInput>
    ): Promise<Goal | null> {
        const existing = await this.getById(userId, goalId);
        if (!existing) return null;

        const query = `
      UPDATE goals SET
        goal_name = COALESCE($3, goal_name),
        description = COALESCE($4, description),
        icon = COALESCE($5, icon),
        color = COALESCE($6, color),
        target_amount = COALESCE($7, target_amount),
        target_date = COALESCE($8, target_date),
        contribution_frequency = COALESCE($9, contribution_frequency),
        contribution_amount = COALESCE($10, contribution_amount),
        linked_account_id = COALESCE($11, linked_account_id),
        metadata = COALESCE($12::jsonb, metadata),
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
        const result = await pool.query(query, [
            goalId,
            userId,
            input.goalName,
            input.description,
            input.icon,
            input.color,
            input.targetAmount,
            input.targetDate,
            input.contributionFrequency,
            input.contributionAmount,
            input.linkedAccountId,
            input.metadata ? JSON.stringify(input.metadata) : null,
        ]);

        return this.mapToGoal(result.rows[0]);
    }

    /**
     * Delete a goal
     */
    async delete(userId: string, goalId: string): Promise<void> {
        const query = `
      UPDATE goals 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
        await pool.query(query, [goalId, userId]);
    }

    /**
     * Add a contribution to a goal
     */
    async addContribution(
        userId: string,
        goalId: string,
        input: ContributionInput
    ): Promise<Contribution> {
        const goal = await this.getById(userId, goalId);
        if (!goal) throw new Error('Goal not found');

        const isWithdrawal = input.contributionType === 'withdrawal';
        const adjustedAmount = isWithdrawal ? -Math.abs(input.amount) : Math.abs(input.amount);
        const newBalance = Math.max(0, goal.currentAmount + adjustedAmount);

        // Insert contribution
        const insertQuery = `
      INSERT INTO goal_contributions (
        goal_id, user_id, amount, contribution_date, contribution_type,
        source_account_id, balance_after, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      )
      RETURNING *
    `;
        const contributionResult = await pool.query(insertQuery, [
            goalId,
            userId,
            adjustedAmount,
            input.contributionDate || new Date().toISOString().split('T')[0],
            input.contributionType || 'manual',
            input.sourceAccountId || null,
            newBalance,
            input.notes || null,
        ]);

        // Update goal
        const isCompleted = newBalance >= goal.targetAmount;
        const updateQuery = `
      UPDATE goals SET
        current_amount = $3,
        status = CASE WHEN $4 THEN 'completed' ELSE status END,
        completed_at = CASE WHEN $4 THEN NOW() ELSE completed_at END,
        updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
        await pool.query(updateQuery, [goalId, userId, newBalance, isCompleted]);

        return this.mapToContribution(contributionResult.rows[0]);
    }

    /**
     * Get contributions for a goal
     */
    async getContributions(userId: string, goalId: string): Promise<Contribution[]> {
        const query = `
      SELECT * FROM goal_contributions
      WHERE goal_id = $1 AND user_id = $2
      ORDER BY contribution_date DESC, created_at DESC
    `;
        const result = await pool.query(query, [goalId, userId]);
        return result.rows.map(this.mapToContribution);
    }

    /**
     * Get detailed progress for a goal
     */
    async getProgress(userId: string, goalId: string): Promise<GoalProgress> {
        const goal = await this.getById(userId, goalId);
        if (!goal) throw new Error('Goal not found');

        const amountRemaining = Math.max(0, goal.targetAmount - goal.currentAmount);

        // Calculate days remaining
        let daysRemaining: number | undefined;
        if (goal.targetDate) {
            daysRemaining = Math.max(0, differenceInDays(new Date(goal.targetDate), new Date()));
        }

        // Calculate if on track
        let onTrack = true;
        let suggestedMonthlyContribution: number | undefined;

        if (goal.targetDate && amountRemaining > 0) {
            const monthsRemaining = Math.max(1, (daysRemaining || 30) / 30);
            suggestedMonthlyContribution = Math.round(amountRemaining / monthsRemaining * 100) / 100;

            // Check if current contribution rate will meet target
            if (goal.contributionAmount && goal.contributionFrequency) {
                let monthlyRate = goal.contributionAmount;
                switch (goal.contributionFrequency) {
                    case 'weekly': monthlyRate *= 4; break;
                    case 'quarterly': monthlyRate /= 3; break;
                    case 'yearly': monthlyRate /= 12; break;
                }
                onTrack = monthlyRate >= suggestedMonthlyContribution;
            }
        }

        // Calculate projected completion
        let projectedCompletion: string | undefined;
        if (goal.contributionAmount && goal.contributionFrequency && amountRemaining > 0) {
            let monthlyRate = goal.contributionAmount;
            switch (goal.contributionFrequency) {
                case 'daily': monthlyRate *= 30; break;
                case 'weekly': monthlyRate *= 4; break;
                case 'quarterly': monthlyRate /= 3; break;
                case 'yearly': monthlyRate /= 12; break;
            }

            if (monthlyRate > 0) {
                const monthsToComplete = Math.ceil(amountRemaining / monthlyRate);
                projectedCompletion = format(addMonths(new Date(), monthsToComplete), 'yyyy-MM-dd');
            }
        }

        // Get recent contributions
        const recentContributions = await this.getContributions(userId, goalId);

        return {
            goal,
            daysRemaining,
            amountRemaining,
            onTrack,
            projectedCompletion,
            suggestedMonthlyContribution,
            recentContributions: recentContributions.slice(0, 5),
        };
    }

    /**
     * Get goals summary
     */
    async getSummary(userId: string): Promise<GoalsSummary> {
        const query = `
      SELECT 
        goal_type,
        status,
        COUNT(*) as count,
        SUM(target_amount) as target_total,
        SUM(current_amount) as current_total
      FROM goals
      WHERE user_id = $1
      GROUP BY goal_type, status
    `;
        const result = await pool.query(query, [userId]);

        const byType: Record<string, { count: number; targetAmount: number; currentAmount: number }> = {};
        let totalGoals = 0;
        let activeGoals = 0;
        let completedGoals = 0;
        let totalTargetAmount = 0;
        let totalCurrentAmount = 0;

        for (const row of result.rows) {
            const count = parseInt(row.count);
            const targetTotal = parseFloat(row.target_total) || 0;
            const currentTotal = parseFloat(row.current_total) || 0;

            if (!byType[row.goal_type]) {
                byType[row.goal_type] = { count: 0, targetAmount: 0, currentAmount: 0 };
            }
            byType[row.goal_type].count += count;
            byType[row.goal_type].targetAmount += targetTotal;
            byType[row.goal_type].currentAmount += currentTotal;

            totalGoals += count;
            totalTargetAmount += targetTotal;
            totalCurrentAmount += currentTotal;

            if (row.status === 'active') activeGoals += count;
            if (row.status === 'completed') completedGoals += count;
        }

        const overallProgress = totalTargetAmount > 0
            ? Math.round((totalCurrentAmount / totalTargetAmount) * 100)
            : 0;

        // Get upcoming milestones (goals close to completion)
        const milestonesQuery = `
      SELECT id, goal_name, progress_percent, target_date
      FROM goals
      WHERE user_id = $1 
        AND status = 'active'
        AND progress_percent >= 50
      ORDER BY progress_percent DESC
      LIMIT 5
    `;
        const milestonesResult = await pool.query(milestonesQuery, [userId]);
        const upcomingMilestones = milestonesResult.rows.map(row => ({
            goalId: row.id,
            goalName: row.goal_name,
            progressPercent: parseFloat(row.progress_percent) || 0,
            targetDate: row.target_date,
        }));

        return {
            totalGoals,
            activeGoals,
            completedGoals,
            totalTargetAmount,
            totalCurrentAmount,
            overallProgress,
            byType,
            upcomingMilestones,
        };
    }

    private mapToGoal(row: Record<string, unknown>): Goal {
        return {
            id: row.id as string,
            userId: row.user_id as string,
            linkedAccountId: row.linked_account_id as string | undefined,
            goalName: row.goal_name as string,
            goalType: row.goal_type as string,
            description: row.description as string | undefined,
            icon: row.icon as string | undefined,
            color: row.color as string | undefined,
            targetAmount: parseFloat(row.target_amount as string) || 0,
            currentAmount: parseFloat(row.current_amount as string) || 0,
            currency: (row.currency as string) || 'INR',
            targetDate: row.target_date as string | undefined,
            startDate: row.start_date as string,
            contributionFrequency: row.contribution_frequency as string | undefined,
            contributionAmount: row.contribution_amount
                ? parseFloat(row.contribution_amount as string)
                : undefined,
            nextContributionDate: row.next_contribution_date as string | undefined,
            progressPercent: parseFloat(row.progress_percent as string) || 0,
            status: row.status as string,
            completedAt: row.completed_at as Date | undefined,
            metadata: row.metadata as Record<string, unknown> | undefined,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        };
    }

    private mapToContribution(row: Record<string, unknown>): Contribution {
        return {
            id: row.id as string,
            goalId: row.goal_id as string,
            amount: parseFloat(row.amount as string) || 0,
            contributionDate: row.contribution_date as string,
            contributionType: row.contribution_type as string,
            sourceAccountId: row.source_account_id as string | undefined,
            balanceAfter: parseFloat(row.balance_after as string) || 0,
            notes: row.notes as string | undefined,
            createdAt: row.created_at as Date,
        };
    }
}
