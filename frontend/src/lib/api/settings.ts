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
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/users/settings`,
      {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = await response.json();
    return data.data || {};
  },

  /**
   * Update user settings
   */
  updateSettings: async (
    data: Partial<UserSettings>
  ): Promise<UserSettings> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/users/settings`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    const result = await response.json();
    return result.data;
  },

  /**
   * Reset settings to defaults
   */
  resetSettings: async (): Promise<UserSettings> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/users/settings/reset`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = await response.json();
    return data.data;
  },

  /**
   * Update specific setting
   */
  updateSetting: async (
    key: keyof UserSettings,
    value: string | number | boolean | object
  ): Promise<UserSettings> => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/users/settings`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }
    );
    const data = await response.json();
    return data.data;
  },
};
