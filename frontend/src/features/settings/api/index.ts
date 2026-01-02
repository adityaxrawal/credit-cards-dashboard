import { apiClient } from "@/lib/api-client";

export interface UserSettings {
  monthly_budget?: number;
  alert_threshold?: number;
  email_notifications?: boolean;
  theme?: "light" | "dark" | "system";
  currency?: string;
  date_format?: string;
  auto_sync_enabled?: boolean;
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
};
