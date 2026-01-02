export interface StatementTransaction {
    date: Date;
    description: string;
    amount: number;
    type: 'debit' | 'credit';
    referenceNumber?: string;
    metadata?: Record<string, any>;
}

export interface ExtractedStatement {
    bankName: string;
    accountNumber?: string; // Last 4 digits or masked
    statementPeriod?: {
        start: Date;
        end: Date;
    };
    transactions: StatementTransaction[];
    rawText?: string;
}

export interface ReconciliationStats {
    totalProcessed: number;
    matched: number;
    newInserted: number;
    skipped: number;
}
