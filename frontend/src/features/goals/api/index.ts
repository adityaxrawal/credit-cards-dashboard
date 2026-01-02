import apiClient from '@/lib/api-client';

// Goal Types
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

export interface ContributionInput {
    amount: number;
    contributionDate?: string;
    contributionType?: 'manual' | 'scheduled' | 'interest' | 'bonus' | 'withdrawal';
    sourceAccountId?: string;
    notes?: string;
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

// Goals API Functions
export const goalsApi = {
    getAll: async (filters?: { status?: string; type?: string }): Promise<Goal[]> => {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.type) params.append('type', filters.type);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiClient.get<Goal[]>(`/api/goals${query}`);
        return response.data || [];
    },

    getById: async (id: string): Promise<Goal> => {
        const response = await apiClient.get<Goal>(`/api/goals/${id}`);
        return response.data!;
    },

    create: async (input: GoalInput): Promise<Goal> => {
        const response = await apiClient.post<Goal>('/api/goals', input);
        return response.data!;
    },

    update: async (id: string, input: Partial<GoalInput>): Promise<Goal> => {
        const response = await apiClient.put<Goal>(`/api/goals/${id}`, input);
        return response.data!;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/api/goals/${id}`);
    },

    addContribution: async (id: string, input: ContributionInput): Promise<Contribution> => {
        const response = await apiClient.post<Contribution>(`/api/goals/${id}/contribute`, input);
        return response.data!;
    },

    getContributions: async (id: string): Promise<Contribution[]> => {
        const response = await apiClient.get<Contribution[]>(`/api/goals/${id}/contributions`);
        return response.data || [];
    },

    getProgress: async (id: string): Promise<GoalProgress> => {
        const response = await apiClient.get<GoalProgress>(`/api/goals/${id}/progress`);
        return response.data!;
    },

    getSummary: async (): Promise<GoalsSummary> => {
        const response = await apiClient.get<GoalsSummary>('/api/goals/summary');
        return response.data!;
    },
};

export default goalsApi;
