export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      credit_cards: {
        Row: {
          bank_name: string
          card_holder_name: string | null
          card_last_4: string
          card_type: string | null
          created_at: string
          current_due: number | null
          due_date: string | null
          id: string
          sender_pattern: string | null
          statement_day: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name: string
          card_holder_name?: string | null
          card_last_4: string
          card_type?: string | null
          created_at?: string
          current_due?: number | null
          due_date?: string | null
          id?: string
          sender_pattern?: string | null
          statement_day?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string
          card_holder_name?: string | null
          card_last_4?: string
          card_type?: string | null
          created_at?: string
          current_due?: number | null
          due_date?: string | null
          id?: string
          sender_pattern?: string | null
          statement_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      spending_limits: {
        Row: {
          alert_threshold: number | null
          category_name: string | null
          created_at: string
          current_spending: number | null
          id: string
          is_active: boolean | null
          limit_amount: number
          limit_type: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number | null
          category_name?: string | null
          created_at?: string
          current_spending?: number | null
          id?: string
          is_active?: boolean | null
          limit_amount: number
          limit_type: string
          user_id: string
        }
        Update: {
          alert_threshold?: number | null
          category_name?: string | null
          created_at?: string
          current_spending?: number | null
          id?: string
          is_active?: boolean | null
          limit_amount?: number
          limit_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spending_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      statements: {
        Row: {
          card_id: string
          created_at: string
          cycle_end: string
          cycle_start: string
          due_date: string
          id: string
          is_paid: boolean | null
          minimum_due: number | null
          statement_month: number
          statement_year: number
          total_due: number
        }
        Insert: {
          card_id: string
          created_at?: string
          cycle_end: string
          cycle_start: string
          due_date: string
          id?: string
          is_paid?: boolean | null
          minimum_due?: number | null
          statement_month: number
          statement_year: number
          total_due: number
        }
        Update: {
          card_id?: string
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          due_date?: string
          id?: string
          is_paid?: boolean | null
          minimum_due?: number | null
          statement_month?: number
          statement_year?: number
          total_due?: number
        }
        Relationships: [
          {
            foreignKeyName: "statements_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          card_id: string
          category: string | null
          created_at: string
          description: string | null
          email_id: string | null
          id: string
          is_in_statement: boolean | null
          merchant_name: string | null
          statement_id: string | null
          transaction_date: string
          transaction_type: string | null
        }
        Insert: {
          amount: number
          card_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          email_id?: string | null
          id?: string
          is_in_statement?: boolean | null
          merchant_name?: string | null
          statement_id?: string | null
          transaction_date: string
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          card_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          email_id?: string | null
          id?: string
          is_in_statement?: boolean | null
          merchant_name?: string | null
          statement_id?: string | null
          transaction_date?: string
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_statement"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          gmail_refresh_token: string | null
          global_spending_limit: number | null
          id: string
          profile_picture_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          gmail_refresh_token?: string | null
          global_spending_limit?: number | null
          id: string
          profile_picture_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          gmail_refresh_token?: string | null
          global_spending_limit?: number | null
          id?: string
          profile_picture_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T]