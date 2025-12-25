import { apiGet } from "./client";
import { SpendingReport, CategoryReport, MonthlyReport } from "../../types/reports";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface DashboardOverview {
  currentMonth: {
    month: number;
    year: number;
    totalSpent: number;
    transactionCount: number;
    byCategory: Record<string, number>;
  };
  previousMonth: {
    month: number;
    year: number;
    totalSpent: number;
    transactionCount: number;
    byCategory: Record<string, number>;
  };
  delta: {
    totalSpent: number;
    transactionCount: number;
  };
}

export interface CategoryBreakdown {
  month: number;
  year: number;
  totalSpent: number;
  categories: Record<string, number>;
}

export interface SpendingTrendItem {
  month: number;
  year: number;
  totalSpent: number;
  transactionCount: number;
}

export interface TopMerchant {
  merchant: string;
  totalSpent: number;
  transactionCount: number;
}

export const analyticsApi = {
  /**
   * Get dashboard overview statistics
   */
  getOverview: async (): Promise<DashboardOverview> => {
    return apiGet<{ data: DashboardOverview }>("/api/analytics/overview").then(
      (res) => res.data
    );
  },

  /**
   * Get spending breakdown by category
   */
  getCategoryBreakdown: async (
    month?: number,
    year?: number
  ): Promise<CategoryBreakdown> => {
    const params = new URLSearchParams();
    if (month) params.append("month", month.toString());
    if (year) params.append("year", year.toString());

    return apiGet<{ data: CategoryBreakdown }>(
      `/api/analytics/categories?${params.toString()}`
    ).then((res) => res.data);
  },

  /**
   * Get spending trend over time
   */
  getTrends: async (
    range: "6m" | "12m" = "6m"
  ): Promise<SpendingTrendItem[]> => {
    return apiGet<{ data: SpendingTrendItem[] }>(
      `/api/analytics/trends?range=${range}`
    ).then((res) => res.data);
  },

  /**
   * Get top merchants
   */
  getTopMerchants: async (
    month?: number,
    year?: number,
    limit: number = 10
  ): Promise<{ month: number; year: number; merchants: TopMerchant[] }> => {
    const params = new URLSearchParams();
    if (month) params.append("month", month.toString());
    if (year) params.append("year", year.toString());
    params.append("limit", limit.toString());

    return apiGet<{ data: { month: number; year: number; merchants: TopMerchant[] } }>(
      `/api/analytics/merchants?${params.toString()}`
    ).then((res) => res.data);
  },

  async getSpendingReport(fromDate: Date, toDate: Date): Promise<SpendingReport> {
    const query = new URLSearchParams({
      startDate: fromDate.toISOString(),
      endDate: toDate.toISOString()
    });
    const response = await apiGet<{ data: SpendingReport }>(`/api/reports/spending?${query}`);
    return response.data;
  },

  async getCategoryReport(month: number, year: number): Promise<CategoryReport[]> {
    const response = await apiGet<{ data: CategoryReport[] }>(
      `/api/reports/category?month=${month}&year=${year}`
    );
    return response.data;
  },

  async getMonthlyReport(year: number): Promise<MonthlyReport[]> {
    const response = await apiGet<{ data: MonthlyReport[] }>(`/api/reports/monthly?year=${year}`);
    return response.data;
  },

  async exportData(format: 'csv' | 'pdf'): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/api/reports/export?format=${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.blob();
  }
};
