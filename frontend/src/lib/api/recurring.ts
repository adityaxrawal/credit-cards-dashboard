import { apiClient } from "@/lib/api-client";
import { RecurringTransaction } from "../../types/recurring";

export const recurringApi = {
    getRecurringTransactions: async (): Promise<RecurringTransaction[]> => {
        const response = await apiClient.get<{ data: RecurringTransaction[] }>("/api/recurring");
        return response.data || [];
    },

    getStats: async (): Promise<{ totalMonthly: number; activeCount: number }> => {
        // Assuming backend endpoint exists or we calculate from list
        // If no stats endpoint, we fetch all and calculate
        const response = await apiClient.get<{ data: RecurringTransaction[] }>("/api/recurring");
        const transactions = response.data || [];

        const active = transactions.filter(t => t.isActive);
        const totalMonthly = active.reduce((acc, t) => acc + t.avgAmount, 0);

        return {
            totalMonthly,
            activeCount: active.length
        };
    }
};
