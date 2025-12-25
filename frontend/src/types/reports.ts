export interface SpendingReport {
    totalSpent: number;
    byCategory: { [key: string]: number };
    byCard: { [key: string]: number };
    avgTransaction: number;
    transactionCount: number;
}

export interface CategoryReport {
    category: string;
    total: number;
    percentage: number;
    transactionCount: number;
}

export interface MonthlyReport {
    month: number;
    year: number;
    total: number;
    byCategory: { [key: string]: number };
}
