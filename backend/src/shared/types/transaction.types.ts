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
    INVESTMENT = 'investment',
    FEE = 'fee',
    // Extended transaction types
    BANK_CHARGE = 'bank_charge',
    INTEREST_DEBIT = 'interest_debit',
    INTEREST_CREDIT = 'interest_credit',
    CHEQUE_DEPOSIT = 'cheque_deposit',
    CHEQUE_RETURN = 'cheque_return',
    ATM_INQUIRY = 'atm_inquiry',
    ATM_WITHDRAWAL = 'atm_withdrawal',
    SWEEP_IN = 'sweep_in',
    SWEEP_OUT = 'sweep_out',
    STANDING_INSTRUCTION = 'standing_instruction',
    ENACH = 'enach',
    CASH_DEPOSIT = 'cash_deposit',
    WALLET_LOAD = 'wallet_load',
    WALLET_UNLOAD = 'wallet_unload',
    CARD_LIMIT_CHANGE = 'card_limit_change',
    PRE_AUTHORIZATION = 'pre_authorization',
    LOAN_DISBURSAL = 'loan_disbursal',        // Classification only, excluded from ingestion
    LOAN_REPAYMENT = 'loan_repayment',        // Classification only, excluded from ingestion
    EMI_CREATION = 'emi_creation',            // Classification only, excluded from ingestion
    EMI_INSTALLMENT = 'emi_installment',      // Classification only, excluded from ingestion
    UNCLASSIFIED = 'unclassified',
}

export enum InstrumentType {
    CREDIT_CARD = 'credit_card',
    DEBIT_CARD = 'debit_card',
    UPI = 'upi',
    UPI_HANDLE = 'upi_handle',
    UPI_ON_CREDIT_CARD = 'upi_on_credit_card',
    BANK_ACCOUNT = 'bank_account',
    SAVINGS_ACCOUNT = 'savings_account',
    IMPS = 'imps',
    NEFT = 'neft',
    RTGS = 'rtgs',
    SWIFT_WIRE = 'swift_wire',
    WALLET_TRANSFER = 'wallet_transfer',
    POS = 'pos',
    ESCROW_TRANSFER = 'escrow_transfer',
}

export enum TransactionDirection {
    DEBIT = 'debit',
    CREDIT = 'credit',
}

export enum TransactionStatus {
    PENDING = 'pending',
    POSTED = 'posted',
    REVERSED = 'reversed',
    FAILED = 'failed',
    HOLD = 'hold',
}

export enum TransactionChannel {
    ATM = 'atm',
    POS = 'pos',
    ECOMMERCE = 'ecommerce',
    UPI = 'upi',
    NETBANKING = 'netbanking',
    NEFT = 'neft',
    RTGS = 'rtgs',
    IMPS = 'imps',
    WIRE = 'wire',
    INTERNAL = 'internal',
    CHEQUE = 'cheque',
}

export enum TransactionLinkType {
    REFUND = 'refund',
    SETTLEMENT = 'settlement',
    PARTIAL_REFUND = 'partial_refund',
    SPLIT = 'split',
    AUTHORIZATION = 'authorization',
    REVERSAL = 'reversal',
}

// ============================================
// Source Type Classification (New Architecture)
// ============================================

export enum SourceType {
    BANK_ALERT = 'bank_alert',
    UPI_APP_EMAIL = 'upi_app_email',
    MERCHANT_RECEIPT = 'merchant_receipt',
    PAYMENT_GATEWAY_RECEIPT = 'payment_gateway_receipt',
    MONTHLY_STATEMENT = 'monthly_statement',
}

// ============================================
// Manual Review System (New Architecture)
// ============================================

export enum ManualReviewReason {
    MISSING_AMOUNT = 'missing_amount',
    MISSING_INSTRUMENT = 'missing_instrument',
    ZERO_AMOUNT = 'zero_amount',
    MULTIPLE_TIMESTAMPS = 'multiple_timestamps',
    SENDER_DOMAIN_MISMATCH = 'sender_domain_mismatch',
    OCR_LOW_CONFIDENCE = 'ocr_low_confidence',
    CONFLICTING_DIRECTION = 'conflicting_direction',
    INVOICE_NO_PAYMENT = 'invoice_no_payment',
    UNRECOGNIZED_CURRENCY = 'unrecognized_currency',
    AMBIGUOUS_REFUND = 'ambiguous_refund',
    CANCELLED_NO_REFUND = 'cancelled_no_refund',
    PDF_PASSWORD_UNKNOWN = 'pdf_password_unknown',
    LOW_CONFIDENCE_SCORE = 'low_confidence_score',
}

export interface ManualReviewTrigger {
    id: string;
    reason: ManualReviewReason;
    details?: string;
}

// ============================================
// Confidence Scoring System (New Architecture)
// ============================================

export interface ConfidenceDetails {
    score: number;
    authoritative_source: boolean;  // +0.4
    instrument_detected: boolean;   // +0.2
    amount_detected: boolean;       // +0.2
    timestamp_detected: boolean;    // +0.1
    reference_id_detected: boolean; // +0.1
    ambiguity_penalty: boolean;     // -0.3
    ocr_uncertainty: boolean;       // -0.3
    contradictory_signals: boolean; // -0.2
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
    authResults?: string; // Fix #2
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
    // ============================================
    // Core Fields (New Architecture)
    // ============================================

    /** Unique event identifier for this transaction (populated by pipeline) */
    unique_event_id?: string;

    type: TransactionType;
    direction: TransactionDirection;
    amount: number;
    currency: string;

    /** Normalized timestamp in UTC (populated by pipeline) */
    timestamp_normalized?: Date;

    merchant?: string;
    counterpartyName?: string;
    counterpartyIdentifier?: string;

    /** Payee name (for debits - who received the money) */
    payee_name?: string;

    /** Payer name (for credits - who sent the money) */
    payer_name?: string;

    /** Transaction location if available */
    location?: string;

    /** Account balance after this transaction */
    balance_after_transaction?: number;

    instrumentType: InstrumentType;
    instrumentId?: string;
    category?: string;
    referenceNumber?: string;
    fingerprint: string;
    metadata?: TransactionMetadata;

    // ============================================
    // Source Tracking (New Architecture)
    // ============================================

    /** Type of source this transaction was extracted from (populated by pipeline) */
    source_type?: SourceType;

    /** Email address of the source */
    source_email_address?: string;

    /** Folder or label ID where source was found */
    source_folder_id?: string;

    /** Thread ID for email grouping */
    source_thread_id?: string;

    // ============================================
    // Confidence Scoring (New Architecture)
    // ============================================

    /** Overall confidence score (0-1) (populated by pipeline) */
    confidence_score?: number;

    /** Detailed breakdown of confidence scoring (populated by pipeline) */
    confidence_details?: ConfidenceDetails;

    // ============================================
    // Manual Review System (New Architecture)
    // ============================================

    /** Whether this transaction requires manual review (populated by pipeline) */
    requires_manual_review?: boolean;

    /** List of reasons triggering manual review */
    review_triggers?: ManualReviewTrigger[];

    // Extended fields for new capabilities
    rrn?: string;
    utr?: string;
    arn?: string;
    authCode?: string;
    postingDate?: Date;
    valueDate?: Date;
    transactionStatus?: TransactionStatus;
    runningBalance?: number;
    fxRate?: number;
    originalCurrency?: string;
    originalAmount?: number;
    feeComponents?: {
        gst?: number;
        tax?: number;
        serviceCharge?: number;
    };
    instrumentDetails?: {
        cardLast4?: string;
        accountMasked?: string;
        upiVpaPayer?: string;
        upiVpaPayee?: string;
    };
    channel?: TransactionChannel;
    mcc?: string;
    isRecurring?: boolean;
    isReversal?: boolean;
    isProvisional?: boolean;
    patternGroupId?: string;
    ruleId?: string;
    extractionQualityScore?: number;

    // ============================================
    // Currency Extraction & Conversion Fields
    // ============================================

    /**
     * Exact amount string as extracted from email (unmodified)
     * Preserves original formatting including currency symbols, commas, etc.
     */
    rawAmountString?: string;

    /**
     * Detected currency ISO code (e.g., 'USD', 'EUR', 'INR')
     * null if currency could not be confidently detected
     */
    detectedCurrency?: string;

    /**
     * Confidence level in currency detection
     */
    currencyConfidence?: 'high' | 'medium' | 'low' | 'unknown';

    /**
     * How the currency was detected
     */
    currencyDetectionMethod?: 'iso_code' | 'symbol' | 'context' | 'position' | 'default' | 'unknown';

    /**
     * Amount converted to target currency (usually INR or user preference)
     */
    convertedAmount?: number;

    /**
     * Exchange rate used for conversion
     */
    conversionRate?: number;

    /**
     * Source of the exchange rate
     */
    rateSource?: 'exchange-api' | 'fallback-json' | 'database' | 'none';

    /**
     * Date of the exchange rate used
     */
    rateDate?: string;

    /**
     * Whether conversion was skipped
     */
    conversionSkipped?: boolean;

    /**
     * Reason conversion was skipped
     */
    conversionSkipReason?: 'unknown_currency' | 'rate_unavailable' | 'already_target' | 'invalid_amount' | 'crypto_rate_unavailable';

    /**
     * Whether the amount is in cryptocurrency
     */
    isCrypto?: boolean;

    /**
     * Any ambiguity flags from currency detection
     */
    currencyAmbiguityFlags?: string[];
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
    metadata: TransactionMetadata;
    created_at: Date;
    updated_at: Date;
    exact_timestamp?: Date;
    email_subject?: string;
    email_sender?: string;
    gmail_thread_id?: string;
    gmail_account_index?: number;
    currency_code?: string;
    original_amount?: number;
    reference_number?: string;
    transaction_subtype?: string;
    direction?: string;
    instrument_type?: string;
    instrument_id?: string;
    parent_transaction_id?: string | null;
    classification_method?: string;
    confidence_score?: number;
    needs_review?: boolean;
    review_reason?: string;
    counterparty_name?: string;
    counterparty_identifier?: string;

    // ============================================
    // Extended Fields (Migration 026)
    // ============================================

    // Reference Numbers
    rrn?: string;                           // Retrieval Reference Number
    utr?: string;                           // Unique Transaction Reference
    arn?: string;                           // Acquirer Reference Number
    auth_code?: string;                     // Authorization code

    // Date Differentiation
    posting_date?: Date;                    // When posted to account
    value_date?: Date;                      // For interest calculation

    // Status & Lifecycle
    transaction_status?: TransactionStatus;

    // Balance & Currency
    running_balance?: number;               // Balance after transaction
    fx_rate?: number;                       // Foreign exchange rate
    original_currency_code?: string;        // Original currency if converted

    // Fee Components
    fee_components?: {
        gst?: number;
        tax?: number;
        service_charge?: number;
        [key: string]: number | undefined;
    };

    // Instrument Details
    instrument_details?: {
        card_last4?: string;
        account_masked?: string;
        upi_vpa_payer?: string;
        upi_vpa_payee?: string;
        [key: string]: string | undefined;
    };

    // Channel & Merchant
    channel?: TransactionChannel;
    mcc?: string;                           // Merchant Category Code

    // Lifecycle Flags
    is_recurring?: boolean;
    is_reversal?: boolean;
    is_provisional?: boolean;
    is_adjustment?: boolean;
    dispute_flag?: boolean;
    chargeback_flag?: boolean;

    // Transaction Linking
    linked_transaction_id?: string;
    link_type?: TransactionLinkType;

    // Provenance & Audit
    parser_version?: string;
    rule_id?: string;
    pattern_group_id?: string;
    extraction_quality_score?: number;
    review_assignee?: string;
    source_message_timestamp?: Date;

    // Category Hierarchy (Migration 027)
    category_id?: string;
    category_confidence?: number;
    category_override_by_user?: boolean;
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

    // Extended filters
    categoryId?: string;
    channel?: TransactionChannel;
    transactionStatus?: TransactionStatus;
    isRecurring?: boolean;
    isReversal?: boolean;
    hasDispute?: boolean;
    hasChargeback?: boolean;
    minAmount?: number;
    maxAmount?: number;
    rrn?: string;
    utr?: string;
    linkedTransactionId?: string;
    page?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface UnclassifiedRecord {
    id: string;
    emailId: string;
    from: string;
    subject: string;
    bodySnippet: string;
    receivedAt: Date;
    analyzedAt: Date;
    tags?: string[];
    potentialCategory?: string;
}

// ============================================
// Category Hierarchy Types
// ============================================

export interface Category {
    id: string;
    name: string;
    slug: string;
    parent_id?: string;
    icon?: string;
    color?: string;
    description?: string;
    is_system: boolean;
    is_personal: boolean;
    is_tax_deductible: boolean;
    sort_order: number;
    created_at: Date;
    updated_at: Date;
    children?: Category[];
}

export interface MerchantCategoryMapping {
    id: string;
    merchant_pattern: string;
    category_id: string;
    priority: number;
    is_regex: boolean;
    created_by?: string;
    created_at: Date;
}

// Types that should be excluded from transaction ingestion
export const EXCLUDED_FROM_INGESTION: TransactionType[] = [
    TransactionType.LOAN_DISBURSAL,
    TransactionType.LOAN_REPAYMENT,
    TransactionType.EMI_CREATION,
    TransactionType.EMI_INSTALLMENT,
];

