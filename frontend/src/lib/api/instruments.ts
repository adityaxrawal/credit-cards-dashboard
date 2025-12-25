import { apiGet } from './core/client';
import { Bank, BankAccount, InstrumentCard } from '../../types/instruments';

export const instrumentApi = {
    async getHierarchy(): Promise<Bank[]> {
        const response = await apiGet<{ data: Bank[] }>('/api/instruments/hierarchy');
        return response.data;
    },

    async getBanks(): Promise<Bank[]> {
        const response = await apiGet<{ data: Bank[] }>('/api/instruments/banks');
        return response.data;
    },

    async getAccountsByBank(bankId: string): Promise<BankAccount[]> {
        const response = await apiGet<{ data: BankAccount[] }>(
            `/api/instruments/banks/${bankId}/accounts`
        );
        return response.data;
    }
};
