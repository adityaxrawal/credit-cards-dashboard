
export enum ReconciliationStatus {
    MATCHED = 'matched',
    PARTIAL_MATCH = 'partial_match',
    MISMATCH = 'mismatch',
    REVIEWED = 'reviewed'
}

export interface ReconciliationConfig {
    tolerance: number; // e.g. 0.01 or 5.00
    autoReconcile: boolean;
}

export interface ReconciliationHistoryRecord {
    id: string;
    userId: string;
    instrumentId: string;
    statementDate: Date;
    statementBalance: number;
    calculatedBalance: number;
    difference: number;
    status: ReconciliationStatus;
    notes?: string;
    createdAt: Date;
}
