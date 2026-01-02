import { apiGet, apiPut, apiDelete } from "@/shared/api/client";

export interface Alert {
  id: string;
  user_id: string;
  type: "budget_exceeded" | "bill_reminder" | "due_reminder" | "system";
  title: string;
  message: string;
  is_read: boolean;
  priority: "low" | "medium" | "high";
  metadata?: unknown;
  created_at: string;
}

export interface AlertListResponse {
  data: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const alertsApi = {
  /**
   * Get user alerts
   */
  getAlerts: async (
    unreadOnly?: boolean,
    page: number = 1,
    limit: number = 50
  ): Promise<AlertListResponse> => {
    const params = new URLSearchParams();
    if (unreadOnly) params.append("unread", "true");
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    return apiGet<AlertListResponse>(`/api/alerts?${params.toString()}`);
  },

  /**
   * Mark alert as read
   */
  markAsRead: async (alertId: string): Promise<void> => {
    await apiPut<void>(`/api/alerts/${alertId}/read`);
  },

  /**
   * Delete an alert
   */
  deleteAlert: async (alertId: string): Promise<void> => {
    await apiDelete<void>(`/api/alerts/${alertId}`);
  },
};
