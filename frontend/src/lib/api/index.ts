import {
  CreditCard,
  Transaction,
  KPIData,
  TransactionStats,
  CardInsights,
  SpendingLimit,
  EmailPreferences,
  GmailIntegration,
  AlertHistory,
  PaginatedResponse,
  TransactionFilters,
  CardFormData,
  TransactionFormData,
  SpendingLimitFormData,
} from "@/types";
import apiClient from "@/lib/api-client";

// Cards API
export const cardsApi = {
  getAll: () => apiClient.get<CreditCard[]>("/api/cards"),
  getById: (id: string) => apiClient.get<CreditCard>(`/api/cards/${id}`),
  create: (data: CardFormData) =>
    apiClient.post<CreditCard>("/api/cards", data),
  update: (id: string, data: Partial<CardFormData>) =>
    apiClient.put<CreditCard>(`/api/cards/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/cards/${id}`),
  getInsights: (id: string) =>
    apiClient.get<CardInsights>(`/api/cards/${id}/insights`),
  getTransactions: (id: string, filters?: TransactionFilters) =>
    apiClient.get<PaginatedResponse<Transaction>>(
      `/api/cards/${id}/transactions`,
      filters as Record<string, unknown>
    ),
};

// Transactions API
export const transactionsApi = {
  getAll: (filters?: TransactionFilters & { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResponse<Transaction>>(
      "/api/transactions",
      filters as Record<string, unknown>
    ),
  getById: (id: string) =>
    apiClient.get<Transaction>(`/api/transactions/${id}`),
  create: (data: TransactionFormData) =>
    apiClient.post<Transaction>("/api/transactions", data),
  update: (id: string, data: Partial<TransactionFormData>) =>
    apiClient.put<Transaction>(`/api/transactions/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/transactions/${id}`),
  getStats: () => apiClient.get<TransactionStats>("/api/transactions/stats"),
  export: (format: "csv" | "pdf" | "excel", filters?: TransactionFilters) =>
    apiClient.get(
      `/api/transactions/export?format=${format}`,
      filters as Record<string, unknown>
    ),
  bulkDelete: (ids: string[]) =>
    apiClient.post("/api/transactions/bulk-delete", { ids }),
};

// KPIs API
export const kpisApi = {
  get: () => apiClient.get<KPIData>("/api/kpis"),
};

// Settings API
export const settingsApi = {
  getSpendingLimit: () =>
    apiClient.get<SpendingLimit>("/api/settings/spending-limit"),
  updateSpendingLimit: (data: SpendingLimitFormData) =>
    apiClient.put<SpendingLimit>("/api/settings/spending-limit", data),
  getEmailPreferences: () =>
    apiClient.get<EmailPreferences>("/api/settings/preferences"),
  updateEmailPreferences: (data: Partial<EmailPreferences>) =>
    apiClient.put<EmailPreferences>("/api/settings/preferences", data),
};

// Gmail Integration API
export const gmailApi = {
  getStatus: () => apiClient.get<GmailIntegration>("/gmail/status"),
  connect: () => apiClient.post<{ authUrl: string }>("/gmail/connect"),
  disconnect: () => apiClient.post("/gmail/disconnect"),
  scanHistorical: () => apiClient.post("/gmail/scan-historical"),
  syncNow: () => apiClient.post("/gmail/sync"),
};

// Alerts API
export const alertsApi = {
  getHistory: () => apiClient.get<AlertHistory[]>("/alerts/history"),
  markAsRead: (id: string) => apiClient.put(`/alerts/history/${id}/read`),
  markAllAsRead: () => apiClient.put("/alerts/history/read-all"),
  clearAll: () => apiClient.delete("/alerts/history"),
};

// Analytics API
export const analyticsApi = {
  getSpendingTrends: (cardId?: string) =>
    apiClient.get(
      "/api/analytics/spending-trends",
      cardId ? { card_id: cardId } : undefined
    ),
  getCategoryAnalysis: (cardId?: string) =>
    apiClient.get(
      "/api/analytics/category-analysis",
      cardId ? { card_id: cardId } : undefined
    ),
  getMonthlyComparison: (cardId?: string) =>
    apiClient.get(
      "/api/analytics/monthly-comparison",
      cardId ? { card_id: cardId } : undefined
    ),
};

// Auth API
export const authApi = {
  googleLogin: () => apiClient.post<{ authUrl: string }>("/auth/google"),
  callback: (code: string) =>
    apiClient.post<{ success: boolean }>(`/auth/callback?code=${code}`),
  logout: () => apiClient.post("/auth/logout"),
  getMe: () => apiClient.get("/auth/me"),
};
