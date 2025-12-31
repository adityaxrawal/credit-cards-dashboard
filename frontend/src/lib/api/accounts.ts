import apiClient from '../api-client';

// Account Types
export interface Account {
    id: string;
    userId: string;
    type: string;
    bankId?: string;
    name: string;
    identifier?: string;
    last4?: string;
    balance: number;
    availableBalance?: number;
    currency: string;
    status: string;
    isPrimary: boolean;
    interestRate?: number;
    openingBalance?: number;
    providerName?: string;
    isFrozen: boolean;
    closedAt?: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface AccountInput {
    type: string;
    name: string;
    bankId?: string;
    identifier?: string;
    last4?: string;
    balance?: number;
    availableBalance?: number;
    currency?: string;
    interestRate?: number;
    openingBalance?: number;
    providerName?: string;
    metadata?: Record<string, unknown>;
}

export interface BalanceHistoryEntry {
    id: string;
    snapshotDate: string;
    balance: number;
    availableBalance?: number;
    isReconciled: boolean;
    reconciledAt?: Date;
    notes?: string;
}

export interface AccountsSummary {
    totalAccounts: number;
    byType: Record<string, { count: number; totalBalance: number }>;
    totalBalance: number;
    totalLiabilities: number;
    netWorth: number;
}

// Accounts API Functions
export const accountsApi = {
    getAll: async (filters?: { type?: string; status?: string }): Promise<Account[]> => {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.status) params.append('status', filters.status);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiClient.get<Account[]>(`/api/accounts${query}`);
        return response.data || [];
    },

    getById: async (id: string): Promise<Account> => {
        const response = await apiClient.get<Account>(`/api/accounts/${id}`);
        return response.data!;
    },

    create: async (input: AccountInput): Promise<Account> => {
        const response = await apiClient.post<Account>('/api/accounts', input);
        return response.data!;
    },

    update: async (id: string, input: Partial<AccountInput>): Promise<Account> => {
        const response = await apiClient.put<Account>(`/api/accounts/${id}`, input);
        return response.data!;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/api/accounts/${id}`);
    },

    updateBalance: async (id: string, balance: number, notes?: string): Promise<{ account: Account; snapshot: BalanceHistoryEntry }> => {
        const response = await apiClient.post<{ account: Account; snapshot: BalanceHistoryEntry }>(`/api/accounts/${id}/balance`, { balance, notes });
        return response.data!;
    },

    getBalanceHistory: async (id: string, startDate?: string, endDate?: string): Promise<BalanceHistoryEntry[]> => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiClient.get<BalanceHistoryEntry[]>(`/api/accounts/${id}/history${query}`);
        return response.data || [];
    },

    reconcile: async (id: string, date?: string, notes?: string): Promise<BalanceHistoryEntry> => {
        const response = await apiClient.post<BalanceHistoryEntry>(`/api/accounts/${id}/reconcile`, { date, notes });
        return response.data!;
    },

    getSummary: async (): Promise<AccountsSummary> => {
        const response = await apiClient.get<AccountsSummary>('/api/accounts/summary');
        return response.data!;
    },

    toggleFreeze: async (id: string, freeze: boolean): Promise<Account> => {
        const response = await apiClient.post<Account>(`/api/accounts/${id}/freeze`, { freeze });
        return response.data!;
    },
};

export default accountsApi;
