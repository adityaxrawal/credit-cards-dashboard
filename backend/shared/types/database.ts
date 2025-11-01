// Database table types

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  profile_picture?: string;
  monthly_budget: number;
  gmail_watch_expiration?: Date;
  gmail_history_id?: string;
  is_active: boolean;
  preferences?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreditCard {
  id: string;
  user_id: string;
  card_name: string;
  bank_name: string;
  card_type?: string;
  last_four_digits?: string;
  bill_date: number;
  due_date: number;
  credit_limit?: number;
  current_outstanding: number;
  is_active: boolean;
  card_activation_date?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: string;
  user_id: string;
  card_id: string;
  transaction_date: Date;
  merchant_name?: string;
  merchant_category?: string;
  amount: number;
  transaction_type: "debit" | "credit" | "refund";
  description?: string;
  billing_cycle_month?: number;
  billing_cycle_year?: number;
  email_message_id?: string;
  is_manually_added: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface BudgetTracking {
  id: string;
  user_id: string;
  month: number;
  year: number;
  budget_limit: number;
  total_spent: number;
  alert_sent: boolean;
  alert_sent_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  user_id: string;
  alert_type: string;
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  is_read: boolean;
  read_at?: Date;
  sent_via_email: boolean;
  email_sent_at?: Date;
  metadata?: Record<string, any>;
  expires_at?: Date;
  created_at: Date;
}

export interface EmailProcessingLog {
  id: string;
  user_id: string;
  email_message_id: string;
  subject?: string;
  from_email?: string;
  received_date?: Date;
  processing_status:
    | "pending"
    | "processing"
    | "processed"
    | "failed"
    | "skipped";
  transaction_id?: string;
  extraction_method?: string;
  confidence_score?: number;
  error_message?: string;
  processed_at?: Date;
  created_at: Date;
}

export interface AnalyticsCache {
  id: string;
  user_id: string;
  metric_key: string;
  metric_value: Record<string, any>;
  period_start?: Date;
  period_end?: Date;
  computed_at: Date;
  expires_at?: Date;
}

export interface GmailToken {
  id: string;
  user_id: string;
  refresh_token: string;
  scope?: string;
  created_at: Date;
  updated_at: Date;
}
