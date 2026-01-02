import { apiGet, apiPut } from "@/shared/api/client";

export interface BudgetStatus {
  month: number;
  year: number;
  monthlyBudget: number;
  spent: number;
  remaining: number;
  ratio: number;
  status: "safe" | "warning" | "critical" | "exceeded";
}

export interface BudgetHistoryItem {
  month: number;
  year: number;
  budgetLimit: number;
  totalSpent: number;
  percentage: number;
  alertSent: boolean;
}

export const budgetApi = {
  /**
   * Get current month budget status
   */
  getCurrentBudget: async (): Promise<BudgetStatus> => {
    return apiGet<{ data: BudgetStatus }>("/api/budget/current").then(
      (res) => res.data
    );
  },

  /**
   * Update monthly budget limit
   */
  updateBudget: async (monthlyBudget: number): Promise<{ monthlyBudget: number }> => {
    return apiPut<{ data: { monthlyBudget: number } }>("/api/budget", {
      monthlyBudget,
    }).then((res) => res.data);
  },

  /**
   * Get budget history
   */
  getBudgetHistory: async (limit: number = 12): Promise<BudgetHistoryItem[]> => {
    return apiGet<{ data: BudgetHistoryItem[] }>(
      `/api/budget/history?limit=${limit}`
    ).then((res) => res.data);
  },
};
