export interface Card {
    id: string;
    user_id: string;
    card_name: string;
    bank_name: string;
    card_number_last4: string;
    bill_date: number;
    due_date: number;
    credit_limit: number;
    current_balance: number;
    is_active: boolean;
    card_activation_date: Date | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

// Placeholder for other types if I find them to move here
// export interface User { ... }
// export interface Transaction { ... }
