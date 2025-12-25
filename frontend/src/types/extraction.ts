export interface TransactionExtractionMetadata {
    extractedBy: 'RULE_BASED' | 'GPT';
    detectionMethod: 'rule-based' | 'gpt';
    detectionConfidence: number;
    confidenceScore: number; // 0-1
    emailmessageid: string;
    rawemailid: string;
    txnFingerprint: string;
    scanjobid: string;
    needsReview: boolean;
    reviewReason?: string;
    amountValidated: boolean;
    amountValidationFlags?: string[];
    processingDurationMs: number;
    extractionStage: 'PENDING' | 'EXTRACTING' | 'VALIDATING' | 'MATCHING' | 'COMPLETED';
    direction: 'DEBIT' | 'CREDIT';
    paymentMethod?: 'CARD' | 'UPI' | 'TRANSFER';
}
