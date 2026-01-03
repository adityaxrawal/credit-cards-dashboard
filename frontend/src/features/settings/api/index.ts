import { apiClient } from "@/lib/api-client";

export interface UserSettings {
  monthly_budget?: number;
  alert_threshold?: number;
  email_notifications?: boolean;
  theme?: "light" | "dark" | "system";
  currency?: string;
  date_format?: string;
  auto_sync_enabled?: boolean;
  timezone?: string;
  available_timezones?: Array<{ value: string; label: string }>;
  notification_preferences?: {
    bill_reminders?: boolean;
    payment_alerts?: boolean;
    spending_alerts?: boolean;
    weekly_summary?: boolean;
  };
}

export interface SettingsResponse {
  settings: UserSettings;
  updated_at: string;
}

export const settingsApi = {
  /**
   * Get user settings
   */
  getSettings: async (): Promise<UserSettings> => {
    const response = await apiClient.get<any>("/api/settings");
    return (response.data?.data || {}) as UserSettings;
  },

  /**
   * Update user settings
   */
  updateSettings: async (
    settingsData: Partial<UserSettings>
  ): Promise<UserSettings> => {
    const result = await apiClient.patch<any>("/api/settings", settingsData);
    return (result.data?.data || {}) as UserSettings;
  },

  /**
   * Reset settings to defaults
   */
  resetSettings: async (): Promise<UserSettings> => {
    const data = await apiClient.post<any>("/api/settings/reset", {});
    return (data.data?.data || {}) as UserSettings;
  },

  /**
   * Update specific setting
   */
  updateSetting: async (
    key: keyof UserSettings,
    value: string | number | boolean | object
  ): Promise<UserSettings> => {
    const data = await apiClient.patch<any>("/api/settings", { [key]: value });
    return (data.data?.data || {}) as UserSettings;
  },

  // PDF Password Management
  listPdfPasswords: async (): Promise<PdfPassword[]> => {
    const response = await apiClient.get<any>("/api/settings/pdf-passwords");
    return (response.data?.data || []) as PdfPassword[];
  },

  addPdfPassword: async (data: CreatePdfPasswordDto): Promise<PdfPassword> => {
    const response = await apiClient.post<any>("/api/settings/pdf-passwords", data);
    return response.data?.data as PdfPassword;
  },

  deletePdfPassword: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/settings/pdf-passwords/${id}`);
  },

  updatePdfPassword: async (id: string, data: { priority: number }): Promise<void> => {
    await apiClient.patch(`/api/settings/pdf-passwords/${id}`, data);
  },
};

export interface PdfPassword {
  id: string;
  password_name: string;
  password_masked: string;
  bank_hint?: string;
  priority: number;
  created_at: string;
}

export interface CreatePdfPasswordDto {
  password_name: string;
  password_value: string;
  bank_hint?: string;
  priority?: number;
}
