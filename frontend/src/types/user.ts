/**
 * User and Authentication Types
 * Types related to user profiles, authentication, and authorization
 */

/**
 * User profile
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Authentication response from login/register
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    profilePicture?: string;
  };
}

/**
 * Email preferences for notifications and alerts
 */
export interface EmailPreferences {
  id: string;
  email_notifications_enabled: boolean;
  spending_limit_alerts: boolean;
  bill_reminders: boolean;
  bill_reminder_days: number;
  unusual_transaction_alerts: boolean;
  weekly_summary: boolean;
  monthly_report: boolean;
  created_at: string;
  updated_at: string;
}
