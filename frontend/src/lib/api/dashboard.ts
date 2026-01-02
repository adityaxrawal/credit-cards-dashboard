import apiClient from '../api-client';

// Dashboard API Types
export interface DashboardSummary {
    netWorth: number;
    accountTotals: {
        bankAccounts: number;
        wallets: number;
        cash: number;
        creditCardOutstanding: number;
        loansOutstanding: number;
    };
    monthlySnapshot: {
        income: number;
        expenses: number;
        savings: number;
        savingsRate: number;
    };
    accountCounts: {
        total: number;
        active: number;
        creditCards: number;
        bankAccounts: number;
        wallets: number;
    };
}

export interface DashboardAlert {
    id: string;
    type: 'bill_due' | 'low_balance' | 'high_credit_utilization' | 'emi_due' | 'goal_reminder' | 'budget_warning';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    dueDate?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
}

export interface CashflowData {
    month: string;
    income: number;
    expenses: number;
    net: number;
}

export interface RecentTransaction {
    id: string;
    date: string;
    merchant: string;
    category: string;
    amount: number;
    direction: 'credit' | 'debit';
    instrumentType: string;
    instrumentName: string;
}

export interface BudgetUsageItem {
    categoryName: string;
    budgetLimit: number;
    spent: number;
    remaining: number;
    usagePercent: number;
    status: 'safe' | 'warning' | 'exceeded';
}

export interface GoalProgress {
    id: string;
    name: string;
    type: string;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
    targetDate?: string;
    status: string;
    color?: string;
    icon?: string;
}

export interface SpendingInsight {
    type: 'top_category' | 'top_merchant' | 'trend' | 'anomaly';
    title: string;
    description: string;
    value?: number;
    change?: number;
    changeType?: 'increase' | 'decrease' | 'stable';
}

// Dashboard API Functions
export const dashboardApi = {
    getSummary: async (): Promise<DashboardSummary> => {
        const response = await apiClient.get<{ data: DashboardSummary }>('/api/dashboard/summary');
        // Backend returns { data: {...} }, extract the nested object
        return response.data?.data!;
    },

    getAlerts: async (): Promise<DashboardAlert[]> => {
        const response = await apiClient.get<{ data: DashboardAlert[] }>('/api/dashboard/alerts');
        // Backend returns { data: [...] }, extract the nested array
        const result = response.data?.data;
        return Array.isArray(result) ? result : [];
    },

    getCashflow: async (months: number = 6): Promise<CashflowData[]> => {
        const response = await apiClient.get<{ data: CashflowData[] }>(`/api/dashboard/cashflow?months=${months}`);
        // Backend returns { data: [...] }, extract the nested array
        const result = response.data?.data;
        return Array.isArray(result) ? result : [];
    },

    getRecentTransactions: async (limit: number = 10): Promise<RecentTransaction[]> => {
        const response = await apiClient.get<{ data: RecentTransaction[] }>(`/api/dashboard/recent?limit=${limit}`);
        // Backend returns { data: [...] }, extract the nested array
        const result = response.data?.data;
        return Array.isArray(result) ? result : [];
    },

    getBudgetUsage: async (): Promise<BudgetUsageItem[]> => {
        const response = await apiClient.get<{ data: BudgetUsageItem[] }>('/api/dashboard/budget-usage');
        // Backend returns { data: [...] }, extract the nested array
        const result = response.data?.data;
        return Array.isArray(result) ? result : [];
    },

    getGoalsProgress: async (): Promise<GoalProgress[]> => {
        const response = await apiClient.get<{ data: GoalProgress[] }>('/api/dashboard/goals-progress');
        // Backend returns { data: [...] }, extract the nested array
        const result = response.data?.data;
        return Array.isArray(result) ? result : [];
    },

    getSpendingInsights: async (): Promise<SpendingInsight[]> => {
        const response = await apiClient.get<{ data: SpendingInsight[] }>('/api/dashboard/insights');
        // Backend returns { data: [...] }, extract the nested array
        const result = response.data?.data;
        return Array.isArray(result) ? result : [];
    },
};

export default dashboardApi;
