export type InstrumentType = 'credit_card' | 'debit_card' | 'bank_account' | 'upi_handle';

export interface Bank {
    id: string;
    name: string;
    logoUrl?: string;
    accountCount: number;
    cardCount: number;
    accounts: BankAccount[];
}

export interface BankAccount {
    id: string;
    bankId: string;
    name: string;
    type: 'SAVINGS' | 'CHECKING' | 'CREDIT' | 'savings_account' | 'current';
    accountNumberMasked: string;
    cardCount: number;
    cards: InstrumentCard[];
}

export interface InstrumentCard {
    id: string;
    accountId: string;
    name: string;
    bankName: string;
    cardNumberLast4: string;

    // Canonical Type
    type?: InstrumentType;

    // Legacy/UI Type
    cardType: 'CREDIT' | 'DEBIT' | 'credit_card' | 'debit_card';

    creditLimit?: number;
    currentBalance: number;
    utilization?: number;
    nextDueDate?: string;
    nextBillDate?: string;
    isActive: boolean;
}
