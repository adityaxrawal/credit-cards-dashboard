/**
 * Database Types for Credit Card Dashboard
 * 
 * This file contains TypeScript interfaces that match the Supabase database schema.
 * These types ensure type safety when working with database operations.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      credit_cards: {
        Row: {
          id: string;
          user_id: string;
          bank_name: string;
          card_name: string;
          card_type: string;
          last_4_digits: string;
          credit_limit: number | null;
          available_credit: number | null;
          billing_cycle_day: number | null;
          annual_fee: number | null;
          reward_rate: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bank_name: string;
          card_name: string;
          card_type: string;
          last_4_digits: string;
          credit_limit?: number | null;
          available_credit?: number | null;
          billing_cycle_day?: number | null;
          annual_fee?: number | null;
          reward_rate?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bank_name?: string;
          card_name?: string;
          card_type?: string;
          last_4_digits?: string;
          credit_limit?: number | null;
          available_credit?: number | null;
          billing_cycle_day?: number | null;
          annual_fee?: number | null;
          reward_rate?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      current_transactions: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          amount: number;
          merchant: string;
          category: string;
          date: string;
          description: string | null;
          transaction_type: 'debit' | 'credit';
          card_last_4: string;
          is_processed: boolean;
          gmail_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          amount: number;
          merchant: string;
          category: string;
          date: string;
          description?: string | null;
          transaction_type: 'debit' | 'credit';
          card_last_4: string;
          is_processed?: boolean;
          gmail_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          amount?: number;
          merchant?: string;
          category?: string;
          date?: string;
          description?: string | null;
          transaction_type?: 'debit' | 'credit';
          card_last_4?: string;
          is_processed?: boolean;
          gmail_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      statements: {
        Row: {
          id: string;
          card_id: string;
          statement_date: string;
          due_date: string | null;
          total_amount: number;
          minimum_amount: number;
          available_credit: number;
          gmail_message_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          statement_date: string;
          due_date?: string | null;
          total_amount: number;
          minimum_amount: number;
          available_credit: number;
          gmail_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          statement_date?: string;
          due_date?: string | null;
          total_amount?: number;
          minimum_amount?: number;
          available_credit?: number;
          gmail_message_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      email_patterns: {
        Row: {
          id: string;
          bank_name: string;
          pattern_type: 'transaction' | 'statement';
          sender_pattern: string;
          subject_pattern: string;
          amount_regex: string | null;
          merchant_regex: string | null;
          date_regex: string | null;
          card_regex: string | null;
          category_mapping: Record<string, string> | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bank_name: string;
          pattern_type: 'transaction' | 'statement';
          sender_pattern: string;
          subject_pattern: string;
          amount_regex?: string | null;
          merchant_regex?: string | null;
          date_regex?: string | null;
          card_regex?: string | null;
          category_mapping?: Record<string, string> | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bank_name?: string;
          pattern_type?: 'transaction' | 'statement';
          sender_pattern?: string;
          subject_pattern?: string;
          amount_regex?: string | null;
          merchant_regex?: string | null;
          date_regex?: string | null;
          card_regex?: string | null;
          category_mapping?: Record<string, string> | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      gmail_tokens: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string;
          token_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scope: string;
          token_type: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          scope?: string;
          token_type?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      processing_queue: {
        Row: {
          id: string;
          job_type: string;
          user_id: string;
          job_data: Record<string, unknown>;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          priority: number;
          attempts: number;
          max_attempts: number;
          scheduled_for: string | null;
          started_at: string | null;
          completed_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_type: string;
          user_id: string;
          job_data: Record<string, unknown>;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          priority?: number;
          attempts?: number;
          max_attempts?: number;
          scheduled_for?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_type?: string;
          user_id?: string;
          job_data?: Record<string, unknown>;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          priority?: number;
          attempts?: number;
          max_attempts?: number;
          scheduled_for?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type CreditCard = Database['public']['Tables']['credit_cards']['Row'];
export type CreditCardInsert = Database['public']['Tables']['credit_cards']['Insert'];
export type CreditCardUpdate = Database['public']['Tables']['credit_cards']['Update'];

export type Transaction = Database['public']['Tables']['current_transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['current_transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['current_transactions']['Update'];

export type Statement = Database['public']['Tables']['statements']['Row'];
export type StatementInsert = Database['public']['Tables']['statements']['Insert'];
export type StatementUpdate = Database['public']['Tables']['statements']['Update'];

export type EmailPattern = Database['public']['Tables']['email_patterns']['Row'];
export type EmailPatternInsert = Database['public']['Tables']['email_patterns']['Insert'];
export type EmailPatternUpdate = Database['public']['Tables']['email_patterns']['Update'];

export type GmailToken = Database['public']['Tables']['gmail_tokens']['Row'];
export type GmailTokenInsert = Database['public']['Tables']['gmail_tokens']['Insert'];
export type GmailTokenUpdate = Database['public']['Tables']['gmail_tokens']['Update'];

export type ProcessingQueue = Database['public']['Tables']['processing_queue']['Row'];
export type ProcessingQueueInsert = Database['public']['Tables']['processing_queue']['Insert'];
export type ProcessingQueueUpdate = Database['public']['Tables']['processing_queue']['Update'];

// Additional utility types
export type TransactionType = 'debit' | 'credit';
export type PatternType = 'transaction' | 'statement';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';