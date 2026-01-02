export interface RecurringTransaction {
    id: string;
    merchantName: string;
    merchant?: string;
    description?: string;
    amount: number;
    frequency: 'monthly' | 'yearly' | 'weekly';
    status: 'active' | 'inactive';
    nextDueDate?: string;
    nextExpectedDate?: string;
    category?: string;
    avgAmount?: number;
    lastDate?: string;
    isActive: boolean;
    direction?: 'credit' | 'debit';
}

export interface RecurringStats {
    totalMonthly: number;
    activeCount: number;
}
