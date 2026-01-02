import { apiClient, apiRequest } from "@/lib/api-client";
import { SpendingReport, CategoryReport, MonthlyReport } from "@/types/reports";

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
  byCategory?: Record<string, number>;
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
    const response = await apiClient.get<{ data: DashboardOverview }>("/api/analytics/overview");
    // apiClient unwraps response.data, but sometimes the API returns { data: ... } inside that
    // Let's check based on API response structure. The apiClient.get returns ApiResponse<T>['data'] which is T if success.
    // However, if the API returns `{ success: true, data: { ... } }`, apiClient returns `{ ... }`.
    // But if the backend endpoint returns just the object, it returns that.
    // Looking at previous analytics.ts, it expected `res.data` from `apiGet`.
    // `apiGet` in client.ts returned `data.data` if available.
    // `apiClient` in api-client.ts also returns `data.data` if available.
    // So the signature of `get` is `Promise<DashboardOverview>`.
    return response as unknown as DashboardOverview;
  },

  /**
   * Get spending breakdown by category
   */
  getCategoryBreakdown: async (
    month?: number,
    year?: number
  ): Promise<CategoryBreakdown> => {
    const params: Record<string, unknown> = {};
    if (month) params.month = month;
    if (year) params.year = year;

    const response = await apiClient.get<CategoryBreakdown>("/api/analytics/categories", params);
    return response as unknown as CategoryBreakdown;
  },

  /**
   * Get spending trend over time
   */
  getTrends: async (
    range: "6m" | "12m" = "6m"
  ): Promise<SpendingTrendItem[]> => {
    const response = await apiClient.get<SpendingTrendItem[]>(`/api/analytics/trends`, { range });
    return response as unknown as SpendingTrendItem[];
  },

  /**
   * Get top merchants
   */
  getTopMerchants: async (
    month?: number,
    year?: number,
    limit: number = 10
  ): Promise<{ month: number; year: number; merchants: TopMerchant[] }> => {
    const params: Record<string, unknown> = { limit };
    if (month) params.month = month;
    if (year) params.year = year;

    const response = await apiClient.get<{ month: number; year: number; merchants: TopMerchant[] }>("/api/analytics/merchants", params);
    return response as unknown as { month: number; year: number; merchants: TopMerchant[] };
  },

  async getSpendingReport(fromDate: Date, toDate: Date): Promise<SpendingReport> {
    const params = {
      startDate: fromDate.toISOString(),
      endDate: toDate.toISOString()
    };
    const response = await apiClient.get<SpendingReport>("/api/reports/spending", params);
    return response as unknown as SpendingReport;
  },

  async getCategoryReport(month: number, year: number): Promise<CategoryReport[]> {
    const response = await apiClient.get<CategoryReport[]>(`/api/reports/category`, { month, year });
    return response as unknown as CategoryReport[];
  },

  async getMonthlyReport(year: number): Promise<MonthlyReport[]> {
    const response = await apiClient.get<MonthlyReport[]>(`/api/reports/monthly`, { year });
    return response as unknown as MonthlyReport[];
  },

  async exportData(format: 'csv' | 'monthly_pdf' | 'category_pdf', params?: any): Promise<Blob> {
    let url = '';
    if (format === 'csv') {
      url = `/api/reports/transactions/export/csv`;
    } else if (format === 'monthly_pdf') {
      url = `/api/reports/monthly-summary/pdf`;
    } else if (format === 'category_pdf') {
      url = `/api/reports/category-breakdown/pdf`;
    }

    if (params) {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
      url += `?${query.toString()}`;
    }

    const response = await apiRequest(url);
    return response.blob();
  }
};
