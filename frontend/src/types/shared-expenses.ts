export interface SharedExpenseGroup {
    id: string;
    group_name: string;
    description: string;
    total_amount: number;
    currency: string;
    expense_date: string;
    is_settled: boolean;
    settled_at: string | null;
    created_at: string;
    creator_id: string;
    splits: ExpenseSplit[];
    category?: string;
    _count?: {
        splits: number;
    };
}

export interface ExpenseSplit {
    id: string;
    shared_expense_id: string;
    participant_name: string;
    participant_email?: string;
    share_amount: number;
    share_percent: number;
    is_paid_by: boolean;
    amount_paid: number;
    is_settled: boolean;
    settled_via?: string;
    settled_at?: string;
}

export interface CreateSharedExpensePayload {
    description: string;
    total_amount: number;
    group_name: string;
    expense_date: string;
    category?: string;
    splits: {
        participant_name: string;
        share_amount: number;
        is_paid_by: boolean;
    }[];
}
