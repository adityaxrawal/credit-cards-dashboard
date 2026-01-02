import { apiClient } from '@/lib/api-client';

// Types
export interface SharedExpenseInput {
    title: string;
    description?: string;
    totalAmount: number;
    currency?: string;
    expenseDate?: string;
    paidByUserId?: string;
    splits: {
        userId?: string;
        memberName: string;
        shareAmount?: number;
        sharePercent?: number;
    }[];
}

export interface ExpenseSplit {
    id: string;
    sharedExpenseId: string;
    userId?: string;
    memberName: string;
    shareAmount: number;
    sharePercent: number;
    isPaid: boolean;
    paidAt?: string;
}

export interface SharedExpense {
    id: string;
    userId: string;
    groupName?: string;
    title: string;
    description?: string;
    totalAmount: number;
    currency: string;
    expenseDate: string;
    paidByUserId?: string;
    status: string;
    splits: ExpenseSplit[];
    createdAt: string;
}

export interface SettlementSummary {
    member_name: string;
    pending_amount: number;
    paid_amount: number;
    pending_count: number;
    paid_count: number;
}

// API Functions
export const sharedExpensesApi = {
    /**
     * Get all shared expenses
     */
    getAll: async (status?: string): Promise<SharedExpense[]> => {
        const params = status ? `?status=${status}` : '';
        const response = await apiClient.get<{ data: SharedExpense[] }>(`/api/shared-expenses${params}`);
        return response.data.data;
    },

    /**
     * Get shared expense by ID
     */
    getById: async (id: string): Promise<SharedExpense> => {
        const response = await apiClient.get<{ data: SharedExpense }>(`/api/shared-expenses/${id}`);
        return response.data.data;
    },

    /**
     * Create shared expense
     */
    create: async (input: SharedExpenseInput): Promise<SharedExpense> => {
        const response = await apiClient.post<{ data: SharedExpense }>('/api/shared-expenses', input);
        return response.data.data;
    },

    /**
     * Delete shared expense
     */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/api/shared-expenses/${id}`);
    },

    /**
     * Mark split as paid
     */
    markSplitPaid: async (splitId: string): Promise<ExpenseSplit> => {
        const response = await apiClient.post<{ data: ExpenseSplit }>(`/api/shared-expenses/splits/${splitId}/pay`);
        return response.data.data;
    },

    /**
     * Get settlement summary
     */
    getSettlementSummary: async (): Promise<SettlementSummary[]> => {
        const response = await apiClient.get<{ data: SettlementSummary[] }>('/api/shared-expenses/summary');
        return response.data.data;
    },
};
