export type UUID = string;

export type InstrumentType = 'credit_card' | 'debit_card' | 'bank_account' | 'upi_handle';
export type InstrumentStatus = 'active' | 'blocked' | 'expired' | 'closed' | 'dormant' | 'cancelled' | 'inactive';

export interface Instrument {
    id: UUID;
    userId: UUID;
    type: InstrumentType;
    bankId?: UUID;

    // Common
    name?: string;       // account_holder_name, card_name, upi_handle
    identifier?: string; // masked number or handle
    last4?: string;
    balance?: number;
    currency?: string;
    status: InstrumentStatus;
    isPrimary: boolean;

    // Metadata (formerly specific columns)
    metadata: {
        // Bank Account specific
        accountType?: 'savings' | 'current' | 'joint';
        openingDate?: Date;
        upiHandle?: string; // if linked to account

        // Credit Card specific
        billDate?: number;
        dueDate?: number;
        creditLimit?: number;
        cardNetwork?: string;
        cardType?: string;
        activationDate?: Date;
        expiryDate?: Date;
        linkedBankAccountId?: UUID;

        // Debit Card specific
        dailyWithdrawalLimit?: number;

        // UPI specific
        provider?: string;
        dailyLimit?: number;
        monthlyLimit?: number;
        registeredPhone?: string;
        verifiedAt?: Date;

        notes?: string;
        [key: string]: any;
    };

    createdAt: Date;
    updatedAt: Date;
}

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

// Compatibility Interfaces (mapped to Instrument)
export interface BankAccount extends Instrument {
    type: 'bank_account';
    // Mapped properties
    accountNumberMasked?: string;
    accountType?: 'savings' | 'current' | 'joint';
    accountHolderName?: string;
    upiHandle?: string;
    notes?: string;
}

export interface CreditCard extends Instrument {
    type: 'credit_card';
    // Mapped properties
    cardName?: string;
    bankAccountId?: UUID; // from linkedBankAccountId
    cardNetwork?: string;
    cardNumberLast4?: string;
    cardNumberMasked?: string;
    cardType?: string;
    cardStatus?: InstrumentStatus;
    billDate?: number;
    dueDate?: number;
    creditLimit?: number;
    currentBalance?: number;
    minimumPayment?: number;
    cardActivationDate?: Date;
    cardExpiryDate?: Date;
    rewardRate?: number;
    notes?: string;
}

export interface DebitCard extends Instrument {
    type: 'debit_card';
    // Mapped properties
    cardName?: string;
    bankAccountId?: UUID;
    cardNetwork?: string;
    cardNumberLast4?: string;
    cardNumberMasked?: string;
    cardStatus?: InstrumentStatus;
    cardActivationDate?: Date;
    cardExpiryDate?: Date;
    dailyWithdrawalLimit?: number;
    notes?: string;
}

export interface UPIHandle extends Instrument {
    type: 'upi_handle';
    // Mapped properties
    bankAccountId?: UUID;
    upiHandle?: string;
    upiProvider?: string;
    isActive?: boolean;
    dailyLimit?: number;
    monthlyLimit?: number;
    registeredPhone?: string;
    verifiedAt?: Date;
    notes?: string;
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

// Deprecated or Aliased types
export type UserInstrument = Instrument; // Alias for now to fix imports
