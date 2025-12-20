export type UUID = string;

// Bank
export interface Bank {
    id: UUID;
    name: string;
    code: string;
    logoUrl?: string;
    website?: string;
    supportEmail?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Bank Account
export interface BankAccount {
    id: UUID;
    userId: UUID;
    bankId: UUID;
    accountNumberMasked: string;
    accountType: 'savings' | 'current' | 'joint';
    accountHolderName?: string;
    accountStatus: 'active' | 'dormant' | 'closed';
    upiHandle?: string;
    isPrimary: boolean;
    openingDate?: Date;
    balance?: number;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// Credit Card
export interface CreditCard {
    id: UUID;
    userId: UUID;
    bankId: UUID;
    bankAccountId?: UUID;
    cardName: string;
    cardNetwork: 'Visa' | 'Mastercard' | 'RuPay' | string;
    cardNumberLast4: string;
    cardNumberMasked: string;
    cardType: 'credit' | 'debit' | 'prepaid';
    cardStatus: 'active' | 'blocked' | 'expired' | 'cancelled';
    billDate: number;
    dueDate: number;
    creditLimit: number;
    currentBalance: number;
    minimumPayment?: number;
    cardActivationDate?: Date;
    cardExpiryDate?: Date;
    isPrimary: boolean;
    rewardRate?: number;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// Debit Card
export interface DebitCard {
    id: UUID;
    userId: UUID;
    bankId: UUID;
    bankAccountId: UUID;
    cardName: string;
    cardNetwork: 'Visa' | 'Mastercard' | 'RuPay' | string;
    cardNumberLast4: string;
    cardNumberMasked: string;
    cardStatus: 'active' | 'blocked' | 'expired' | 'cancelled';
    cardActivationDate?: Date;
    cardExpiryDate?: Date;
    dailyWithdrawalLimit?: number;
    isPrimary: boolean;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// UPI Handle
export interface UPIHandle {
    id: UUID;
    userId: UUID;
    bankId: UUID;
    bankAccountId: UUID;
    upiHandle: string;  // e.g., "user@okaxis"
    upiProvider?: string;
    isPrimary: boolean;
    isActive: boolean;
    dailyLimit?: number;
    monthlyLimit?: number;
    registeredPhone?: string;
    verifiedAt?: Date;
    notes?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// Unified User Instrument
export interface UserInstrument {
    id: UUID;
    userId: UUID;
    instrumentType: 'credit_card' | 'debit_card' | 'bank_account' | 'upi_handle';
    instrumentId: UUID;
    identifierMask: string;
    last4Digits?: string;
    bankId: UUID;
    bankAccountId?: UUID;
    isActive: boolean;
    isPrimary: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Hierarchy View
export interface BankHierarchy {
    userId: UUID;
    banks: Array<{
        bankId: UUID;
        bankName: string;
        bankCode: string;
        accounts: Array<{
            accountId: UUID;
            accountType: string;
            accountNumberMasked: string;
            upiHandle?: string;
            creditCards: Array<{
                cardId: UUID;
                cardName: string;
                last4: string;
                status: string;
            }>;
            debitCards: Array<{
                cardId: UUID;
                cardName: string;
                last4: string;
                status: string;
            }>;
            upiHandles: Array<{
                handleId: UUID;
                upiHandle: string;
                isActive: boolean;
            }>;
        }>;
    }>;
}
