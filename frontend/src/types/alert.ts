/**
 * Alert and Notification Types
 * Types related to alerts, notifications, and user notifications
 */

/**
 * Alert history entry
 */
export interface AlertHistory {
  id: string;
  type: "spending_limit" | "bill_reminder" | "unusual_transaction" | "system";
  message: string;
  is_read: boolean;
  created_at: string;
}
