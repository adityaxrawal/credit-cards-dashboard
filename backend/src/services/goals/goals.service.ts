import { GoalsRepository, GoalRow, ContributionRow } from '../../repositories/GoalsRepository';
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
        const rows = await GoalsRepository.findAll(userId, filters);
        return rows.map(this.mapToGoal);
    }

    /**
     * Get goal by ID
     */
    async getById(userId: string, goalId: string): Promise<Goal | null> {
        const row = await GoalsRepository.findById(userId, goalId);
        if (!row) return null;
        return this.mapToGoal(row);
    }

    /**
     * Create a new goal
     */
    async create(userId: string, input: GoalInput): Promise<Goal> {
        // Calculate next contribution date
        let nextContributionDate: string | undefined;
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

        const row = await GoalsRepository.create({
            userId,
            goalName: input.goalName,
            goalType: input.goalType,
            description: input.description,
            icon: input.icon,
            color: input.color,
            targetAmount: input.targetAmount,
            currentAmount: input.currentAmount || 0,
            currency: input.currency || 'INR',
            targetDate: input.targetDate,
            startDate: format(new Date(), 'yyyy-MM-dd'),
            contributionFrequency: input.contributionFrequency,
            contributionAmount: input.contributionAmount,
            nextContributionDate,
            linkedAccountId: input.linkedAccountId,
            metadata: input.metadata || {},
        });

        // If initial amount provided, create contribution record
        if (input.currentAmount && input.currentAmount > 0) {
            await this.addContribution(userId, row.id, {
                amount: input.currentAmount,
                contributionType: 'manual',
                notes: 'Initial contribution',
            });
        }

        return this.mapToGoal(row);
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

        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (input.goalName) { setClauses.push(`goal_name = $${idx++}`); values.push(input.goalName); }
        if (input.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(input.description); }
        if (input.icon !== undefined) { setClauses.push(`icon = $${idx++}`); values.push(input.icon); }
        if (input.color !== undefined) { setClauses.push(`color = $${idx++}`); values.push(input.color); }
        if (input.targetAmount !== undefined) { setClauses.push(`target_amount = $${idx++}`); values.push(input.targetAmount); }
        if (input.targetDate !== undefined) { setClauses.push(`target_date = $${idx++}`); values.push(input.targetDate); }
        if (input.contributionFrequency !== undefined) { setClauses.push(`contribution_frequency = $${idx++}`); values.push(input.contributionFrequency); }
        if (input.contributionAmount !== undefined) { setClauses.push(`contribution_amount = $${idx++}`); values.push(input.contributionAmount); }
        if (input.linkedAccountId !== undefined) { setClauses.push(`linked_account_id = $${idx++}`); values.push(input.linkedAccountId); }
        if (input.metadata) { setClauses.push(`metadata = $${idx++}::jsonb`); values.push(JSON.stringify(input.metadata)); }

        const row = await GoalsRepository.update(goalId, userId, setClauses, values);
        return row ? this.mapToGoal(row) : null;
    }

    /**
     * Delete a goal
     */
    async delete(userId: string, goalId: string): Promise<void> {
        await GoalsRepository.delete(goalId, userId);
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
        const contributionRow = await GoalsRepository.addContribution({
            goalId,
            amount: adjustedAmount,
            contributionDate: input.contributionDate || new Date().toISOString().split('T')[0],
            contributionType: input.contributionType || 'manual',
            sourceAccountId: input.sourceAccountId,
            balanceAfter: newBalance,
            notes: input.notes,
        });

        // Update goal
        const isCompleted = newBalance >= goal.targetAmount;
        const progressPercent = (newBalance / goal.targetAmount) * 100;

        await GoalsRepository.updateAfterContribution(
            goalId,
            userId,
            newBalance,
            progressPercent,
            isCompleted ? 'completed' : goal.status,
            isCompleted ? new Date() : null
        );

        return this.mapToContribution(contributionRow);
    }

    /**
     * Get contributions for a goal
     */
    async getContributions(userId: string, goalId: string): Promise<Contribution[]> {
        const rows = await GoalsRepository.getContributions(goalId);
        return rows.map(this.mapToContribution);
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
        const summaryRows = await GoalsRepository.getSummary(userId);

        const byType: Record<string, { count: number; targetAmount: number; currentAmount: number }> = {};
        let totalGoals = 0;
        let activeGoals = 0;
        let completedGoals = 0;
        let totalTargetAmount = 0;
        let totalCurrentAmount = 0;

        for (const row of summaryRows) {
            const count = parseInt(row.count);
            const targetTotal = parseFloat(row.target_amount) || 0;
            const currentTotal = parseFloat(row.current_amount) || 0;

            if (!byType[row.status]) {
                byType[row.status] = { count: 0, targetAmount: 0, currentAmount: 0 };
            }
            byType[row.status].count += count;
            byType[row.status].targetAmount += targetTotal;
            byType[row.status].currentAmount += currentTotal;

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
        const milestones = await GoalsRepository.getUpcomingMilestones(userId, 5);
        const upcomingMilestones = milestones.map(row => ({
            goalId: row.id,
            goalName: row.goal_name,
            progressPercent: parseFloat(String(row.progress_percent)) || 0,
            targetDate: row.target_date ?? undefined,
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

    private mapToGoal(row: GoalRow): Goal {
        return {
            id: row.id,
            userId: row.user_id,
            linkedAccountId: row.linked_account_id ?? undefined,
            goalName: row.goal_name,
            goalType: row.goal_type,
            description: row.description ?? undefined,
            icon: row.icon ?? undefined,
            color: row.color ?? undefined,
            targetAmount: parseFloat(String(row.target_amount)) || 0,
            currentAmount: parseFloat(String(row.current_amount)) || 0,
            currency: row.currency || 'INR',
            targetDate: row.target_date ?? undefined,
            startDate: row.start_date,
            contributionFrequency: row.contribution_frequency ?? undefined,
            contributionAmount: row.contribution_amount
                ? parseFloat(String(row.contribution_amount))
                : undefined,
            nextContributionDate: row.next_contribution_date ?? undefined,
            progressPercent: parseFloat(String(row.progress_percent)) || 0,
            status: row.status,
            completedAt: row.completed_at ?? undefined,
            metadata: row.metadata ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private mapToContribution(row: ContributionRow): Contribution {
        return {
            id: row.id,
            goalId: row.goal_id,
            amount: parseFloat(String(row.amount)) || 0,
            contributionDate: row.contribution_date,
            contributionType: row.contribution_type,
            sourceAccountId: row.source_account_id ?? undefined,
            balanceAfter: parseFloat(String(row.balance_after)) || 0,
            notes: row.notes ?? undefined,
            createdAt: row.created_at,
        };
    }
}
