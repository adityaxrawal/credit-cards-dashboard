export enum TransactionType {
    CREDIT_CARD_SPEND = 'cc_spend',
    CREDIT_CARD_UPI = 'cc_upi',
    CREDIT_CARD_PAYMENT = 'cc_payment',
    CREDIT_CARD_REVERSAL = 'cc_reversal',
    BANK_DEBIT = 'bank_debit',
    BANK_ACCOUNT_UPI_DEBIT = 'bank_upi_debit',
    BANK_CREDIT = 'bank_credit',
    BANK_ACCOUNT_UPI_CREDIT = 'bank_upi_credit',
    SALARY = 'salary',
    REFUND_REVERSAL = 'refund',
    CHARGEBACK = 'chargeback',
    STATEMENT_TRANSACTION = 'statement_txn',
    UNCLASSIFIED = 'unclassified',
}

export enum InstrumentType {
    CREDIT_CARD = 'credit_card',
    DEBIT_CARD = 'debit_card',
    UPI = 'upi',
    UPI_HANDLE = 'upi_handle',
    BANK_ACCOUNT = 'bank_account',
    SAVINGS_ACCOUNT = 'savings_account',
}

export enum TransactionDirection {
    DEBIT = 'debit',
    CREDIT = 'credit',
}

export interface Instrument {
    id: string;
    user_id: string;
    instrument_type: InstrumentType;
    bank_name: string;
    account_number_masked: string;
    upi_handle?: string;
    card_name?: string;
    is_active: boolean;
    is_primary: boolean;
}

export interface SimplifiedEmail {
    messageId: string;
    internalDate: number;
    subject: string;
    from: string;
    snippet?: string;
    raw_snippet?: string;
    // New architecture fields
    threadId?: string;
    to?: string;
    body: string; // Visible text or snippet
    bodyHtml?: string;
    bodyText?: string;
    attachments?: {
        id: string;
        filename: string;
        mimeType: string;
        size?: number;
    }[];
}

export interface CleanEmail {
    id: string;
    subject: string;
    from: string;
    cleanedBody: string;
    internalDate: number; // Keep as number for consistency
    hasAttachments: boolean;
    attachments?: Array<{
        filename: string;
        mimeType: string;
        data: Buffer;
    }>;
    raw?: any; // For legacy pipeline compatibility
    date?: any; // For legacy extraction compatibility
}

export interface TransactionMetadata {
    [key: string]: unknown; // Flexible for now, but safer than any
    original_merchant?: string;
    payment_mode?: string;
    bank_ref_num?: string;
    tax_amount?: number;
    location?: string;
    is_recurring?: boolean;
    installments?: {
        current: number;
        total: number;
    };
    related_message_ids?: string[];
}

export interface ClassificationResult {
    type: TransactionType;
    confidence: number; // 0-1
    metadata?: TransactionMetadata;
}

export interface ExtractedTransaction {
    type: TransactionType;
    direction: TransactionDirection;
    amount: number;
    currency: string;
    merchant?: string;
    counterpartyName?: string;
    counterpartyIdentifier?: string;
    instrumentType: InstrumentType;
    instrumentId?: string;
    category?: string;
    referenceNumber?: string;
    fingerprint: string;
    metadata?: TransactionMetadata;
}

export interface PipelineResult {
    status: 'success' | 'failed' | 'terminated' | 'duplicate' | 'needs_review' | 'queued_for_gpt';
    transactionId?: string;
    reason?: string;
    error?: string;
    cleanEmail?: CleanEmail;
    rawEmailId?: string;
}

export interface Transaction {
    id: string;
    user_id: string;
    card_id: string;
    transaction_date: Date;
    merchant: string;
    category: string;
    amount: number;
    transaction_type: string;
    description: string | null;
    bill_month: number | null;
    bill_year: number | null;
    is_settled: boolean;
    email_message_id: string | null;
    is_manually_added: boolean;
    metadata: TransactionMetadata; // Was any
    created_at: Date;
    updated_at: Date;
    exact_timestamp?: Date;
    email_subject?: string;
    gmail_thread_id?: string;
    gmail_account_index?: number;
    currency_code?: string;
    original_amount?: number;
    reference_number?: string;
    transaction_subtype?: string;
    direction?: string;
    instrument_type?: string;
    instrument_id?: string;
    classification_method?: string;
    confidence_score?: number;
    needs_review?: boolean;
    review_reason?: string;
    counterparty_name?: string;
    counterparty_identifier?: string;
}

export interface PostProcessingStats {
    billsCreated?: number;
    instrumentsCreated?: number;
}

export interface TransactionFilters {
    cardId?: string;
    instrumentType?: string;
    instrumentId?: string;
    direction?: string;
    from?: Date;
    to?: Date;
    billMonth?: number;
    billYear?: number;
    category?: string;
    transactionType?: string;
    merchant?: string;
    limit?: number;
    offset?: number;
    needsReview?: boolean;
    search?: string;
}
