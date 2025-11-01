import { apiClient } from "./client";

export interface DashboardOverview {
  total_cards: number;
  monthly_spending: number;
  total_transactions: number;
  total_outstanding: number;
  credit_utilization: number;
  monthly_budget?: number;
  budget_utilization?: number;
  budget_remaining?: number;
}

export interface CategorySpending {
  category: string;
  total: number;
}

export interface SpendingTrendItem {
  period: string;
  debit: number;
  credit: number;
  net: number;
}

export interface UpcomingBill {
  card_id: string;
  card_name: string;
  bank_name: string;
  due_date: number;
  outstanding: number;
  days_until_due: number;
}

export interface CardUtilization {
  card_id: string;
  card_name: string;
  bank_name: string;
  utilized: number;
  limit: number;
  available: number;
  utilization_percentage: number;
}

export interface MonthlyComparison {
  current_month: {
    total: number;
    period: string;
  };
  previous_month: {
    total: number;
    period: string;
  };
  difference: number;
  percentage_change: number;
  trend: "up" | "down" | "same";
}

export const analyticsApi = {
  /**
   * Get dashboard overview statistics
   */
  getDashboardOverview: async (): Promise<DashboardOverview> => {
    const response = await apiClient.get("/analytics/dashboard");
    return response.data.data;
  },

  /**
   * Get spending breakdown by category
   */
  getSpendingByCategory: async (
    startDate?: string,
    endDate?: string
  ): Promise<CategorySpending[]> => {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    const response = await apiClient.get(
      `/analytics/spending-by-category?${params.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get spending trend over time
   */
  getSpendingTrend: async (
    period: "week" | "month" | "year" = "month",
    limit: number = 12
  ): Promise<SpendingTrendItem[]> => {
    const response = await apiClient.get(
      `/analytics/spending-trend?period=${period}&limit=${limit}`
    );
    return response.data.data.trend;
  },

  /**
   * Get upcoming bills
   */
  getUpcomingBills: async (days: number = 30): Promise<UpcomingBill[]> => {
    const response = await apiClient.get(
      `/analytics/upcoming-bills?days=${days}`
    );
    return response.data.data.bills;
  },

  /**
   * Get card utilization
   */
  getCardUtilization: async (): Promise<CardUtilization[]> => {
    const response = await apiClient.get("/analytics/card-utilization");
    return response.data.data.cards;
  },

  /**
   * Get monthly comparison
   */
  getMonthlyComparison: async (): Promise<MonthlyComparison> => {
    const response = await apiClient.get("/analytics/monthly-comparison");
    return response.data.data;
  },
};
