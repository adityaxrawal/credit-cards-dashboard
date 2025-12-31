import { apiClient } from '../api-client';

// Types
export interface TransferInput {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date?: string;
    description?: string;
    notes?: string;
}

export interface TransferResult {
    debit: any;
    credit: any;
    pairId: string;
}

export interface TransferMatch {
    debitTransactionId: string;
    creditTransactionId: string;
    matchConfidence: number;
    matchReason: string;
}

export interface TransferHistory {
    debit_id: string;
    amount: number;
    transaction_date: string;
    description: string;
    transfer_pair_id: string;
    from_account_id: string;
    from_account_name: string;
    to_account_id: string;
    to_account_name: string;
}

// API Functions
export const transfersApi = {
    /**
     * Create internal transfer between accounts
     */
    create: async (input: TransferInput): Promise<TransferResult> => {
        const response = await apiClient.post<{ data: TransferResult }>('/api/transfers', input);
        return response.data.data;
    },

    /**
     * Find potential transfer matches
     */
    findPotentialMatches: async (): Promise<TransferMatch[]> => {
        const response = await apiClient.get<{ data: TransferMatch[] }>('/api/transfers/potential-matches');
        return response.data.data;
    },

    /**
     * Link two transactions as a transfer
     */
    link: async (debitTransactionId: string, creditTransactionId: string): Promise<{ pairId: string }> => {
        const response = await apiClient.post<{ data: { pairId: string } }>('/api/transfers/link', {
            debitTransactionId,
            creditTransactionId,
        });
        return response.data.data;
    },

    /**
     * Get transfer history
     */
    getHistory: async (limit?: number): Promise<TransferHistory[]> => {
        const params = limit ? `?limit=${limit}` : '';
        const response = await apiClient.get<{ data: TransferHistory[] }>(`/api/transfers/history${params}`);
        return response.data.data;
    },
};
