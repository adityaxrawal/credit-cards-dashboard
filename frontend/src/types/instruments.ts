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
    type: 'SAVINGS' | 'CHECKING' | 'CREDIT';
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
    cardType: 'CREDIT' | 'DEBIT';
    creditLimit?: number;
    currentBalance: number;
    utilization?: number;
    nextDueDate?: string;
    nextBillDate?: string;
    isActive: boolean;
}
