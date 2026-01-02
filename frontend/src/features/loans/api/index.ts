import apiClient from '@/lib/api-client';

// Loan Types
export interface Loan {
    id: string;
    userId: string;
    loanName: string;
    loanType: string;
    lenderName?: string;
    loanAccountNumber?: string;
    principalAmount: number;
    currentOutstanding: number;
    interestRate: number;
    interestType: string;
    emiAmount?: number;
    tenureMonths?: number;
    emiDayOfMonth?: number;
    startDate: string;
    endDate?: string;
    totalPaid: number;
    totalInterestPaid: number;
    totalPrincipalPaid: number;
    remainingEmis?: number;
    nextEmiDate?: string;
    lastPaymentDate?: string;
    status: string;
    isAutoDebit: boolean;
    autoDebitAccountId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface LoanInput {
    loanName: string;
    loanType: string;
    lenderName?: string;
    loanAccountNumber?: string;
    principalAmount: number;
    interestRate: number;
    interestType?: 'fixed' | 'floating';
    emiAmount?: number;
    tenureMonths?: number;
    emiDayOfMonth?: number;
    startDate: string;
    isAutoDebit?: boolean;
    autoDebitAccountId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
}

export interface LoanPayment {
    id: string;
    loanId: string;
    paymentDate: string;
    paymentAmount: number;
    principalComponent: number;
    interestComponent: number;
    feesComponent: number;
    outstandingAfter: number;
    paymentType: string;
    paymentMode?: string;
    referenceNumber?: string;
    status: string;
    isOnTime: boolean;
    daysLate: number;
    notes?: string;
    createdAt: Date;
}

export interface LoanPaymentInput {
    paymentDate: string;
    paymentAmount: number;
    principalComponent?: number;
    interestComponent?: number;
    feesComponent?: number;
    paymentType?: 'emi' | 'prepayment' | 'partial' | 'final' | 'penalty';
    paymentMode?: string;
    referenceNumber?: string;
    notes?: string;
}

export interface AmortizationEntry {
    emiNumber: number;
    dueDate: string;
    openingBalance: number;
    emiAmount: number;
    principalComponent: number;
    interestComponent: number;
    closingBalance: number;
    isPaid: boolean;
    paymentDate?: string;
}

export interface PrepaymentImpact {
    currentOutstanding: number;
    prepaymentAmount: number;
    newOutstanding: number;
    interestSaved: number;
    tenureReduction?: number;
    newTenureMonths?: number;
    newEmiAmount?: number;
    remainingEmis?: number;
}

export interface LoansSummary {
    totalLoans: number;
    activeLoans: number;
    totalOutstanding: number;
    totalMonthlyEmi: number;
    byType: Record<string, { count: number; outstanding: number; monthlyEmi: number }>;
    upcomingEmis: Array<{
        loanId: string;
        loanName: string;
        emiAmount: number;
        dueDate: string;
    }>;
}

// Loans API Functions
export const loansApi = {
    getAll: async (filters?: { status?: string; type?: string }): Promise<Loan[]> => {
        const params = new URLSearchParams();
        if (filters?.status) params.append('status', filters.status);
        if (filters?.type) params.append('type', filters.type);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiClient.get<Loan[]>(`/api/loans${query}`);
        return response.data || [];
    },

    getById: async (id: string): Promise<Loan> => {
        const response = await apiClient.get<Loan>(`/api/loans/${id}`);
        return response.data!;
    },

    create: async (input: LoanInput): Promise<Loan> => {
        const response = await apiClient.post<Loan>('/api/loans', input);
        return response.data!;
    },

    update: async (id: string, input: Partial<LoanInput>): Promise<Loan> => {
        const response = await apiClient.put<Loan>(`/api/loans/${id}`, input);
        return response.data!;
    },

    close: async (id: string): Promise<void> => {
        await apiClient.delete(`/api/loans/${id}`);
    },

    getAmortization: async (id: string): Promise<AmortizationEntry[]> => {
        const response = await apiClient.get<AmortizationEntry[]>(`/api/loans/${id}/amortization`);
        return response.data || [];
    },

    getPaymentHistory: async (id: string): Promise<LoanPayment[]> => {
        const response = await apiClient.get<LoanPayment[]>(`/api/loans/${id}/payments`);
        return response.data || [];
    },

    recordPayment: async (id: string, input: LoanPaymentInput): Promise<LoanPayment> => {
        const response = await apiClient.post<LoanPayment>(`/api/loans/${id}/payment`, input);
        return response.data!;
    },

    calculatePrepayment: async (id: string, amount: number, options: { reduceEmi?: boolean; reduceTenure?: boolean }): Promise<PrepaymentImpact> => {
        const response = await apiClient.post<PrepaymentImpact>(`/api/loans/${id}/prepay`, { amount, ...options });
        return response.data!;
    },

    getSummary: async (): Promise<LoansSummary> => {
        const response = await apiClient.get<LoansSummary>('/api/loans/summary');
        return response.data!;
    },
};

export default loansApi;
