export interface RecurringTransaction {
    id: string;
    merchantName: string;
    amount: number;
    frequency: 'monthly' | 'yearly' | 'weekly';
    status: 'active' | 'inactive';
    nextDueDate?: string;
    category?: string;
    avgAmount?: number;
    lastDate?: string;
    isActive: boolean;
}

export interface RecurringStats {
    totalMonthly: number;
    activeCount: number;
}
