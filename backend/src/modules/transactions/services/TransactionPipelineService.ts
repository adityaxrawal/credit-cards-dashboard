/**
 * Transaction Pipeline Service
 * Email/bulk ingestion operations
 * 
 * Extracted from TransactionService as part of Issue #4 CQRS-lite decomposition
 */

import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';
import { TransactionDeduplicator } from '@modules/transactions/services/TransactionDeduplicator'; // Fix #1
import dayjs from 'dayjs';
import { TransactionMetadata } from '@shared/types/transaction.types';
import { invalidateTransactionCache } from '@shared/utils/cache/cacheInvalidation';
import logger from '@shared/utils/infrastructure/logger';

export interface EmailTransactionData {
    instrumentType: string;
    instrumentId?: string;
    cardId?: string;
    amount: number;
    transactionDate: Date;
    merchant: string;
    category: string;
    emailMessageId: string;
    direction: 'credit' | 'debit';
    metadata?: TransactionMetadata;
    exactTimestamp?: Date;
    emailSubject?: string;
    gmailThreadId?: string;
    currencyCode?: string;
    referenceNumber?: string;
    transactionType: string;
    transactionSubtype?: string;
    classificationMethod: string;
    rawExtraction?: any;
    scanJobId?: string;
    // Extended fields for dedup (Fix #1)
    rrn?: string;
    arn?: string;
    upiRef?: string;
    impsRef?: string;

    walletTxnId?: string;
    // Multi-currency support (Fix #8)
    originalCurrency?: string;
    exchangeRate?: number;
    conversionSkipped?: boolean;
    originalAmount?: number;
}

export class TransactionPipelineService {
    /**
     * Insert a transaction from email processing
     */
    static async insertFromEmail(userId: string, data: EmailTransactionData) {
        logger.debug(`[TransactionPipelineService] Inserting from email for user ${userId}`);

        // Prepare fingerprint components
        const components = {
            amount: data.amount,
            merchant: data.merchant,
            date: data.transactionDate,
            bankDomain: (data.metadata?.bankName as string) || 'unknown',
            direction: data.direction,
            // Fix #1: Include references
            rrn: data.rrn || this.extractRrnFromRef(data.referenceNumber),
            arn: data.arn,
            upiRef: data.upiRef,
            originalAmount: data.originalAmount,
            originalCurrency: data.originalCurrency
        };

        const txnFingerprint = TransactionDeduplicator.generateFingerprint(components);

        const txDate = dayjs(data.transactionDate);
        const billMonth = txDate.month() + 1;
        const billYear = txDate.year();

        // Use Deduplicator to Check/Create
        const result = await TransactionDeduplicator.getOrCreate(
            userId,
            txnFingerprint,
            components,
            async () => {
                const inserted = await TransactionRepository.create({
                    userId,
                    instrumentType: data.instrumentType,
                    instrumentId: data.instrumentId || data.cardId,
                    transactionDate: data.transactionDate,
                    merchant: data.merchant,
                    category: data.category || 'Others',
                    amount: data.amount,
                    transactionType: data.transactionType,
                    direction: data.direction,
                    billMonth,
                    billYear,
                    emailMessageId: data.emailMessageId,
                    txnFingerprint,
                    isManuallyAdded: false,
                    metadata: data.metadata,
                    classificationMethod: data.classificationMethod,

                    parentTransactionId: undefined,
                    // Pass extended fields
                    referenceNumber: data.referenceNumber || data.rrn,
                    originalCurrency: data.originalCurrency,
                    exchangeRate: data.exchangeRate,
                    conversionSkipped: data.conversionSkipped,
                    originalAmount: data.originalAmount
                });
                return inserted ? inserted.id : null;
            }
        );

        if (result.isNew) {
            await invalidateTransactionCache(userId);
            // Re-fetch object to return full transaction
            if (result.transactionId) {
                return TransactionRepository.findById(userId, result.transactionId);
            }
        } else {
            logger.debug(`[TransactionPipelineService] Skipped duplicate. Strategy: ${result.mergeStrategy}`);
        }

        return result.transactionId ? { id: result.transactionId, isDuplicate: !result.isNew } : null;
    }

    /**
     * Bulk insert transactions from email processing
     */
    static async insertFromEmailBulk(userId: string, items: EmailTransactionData[]) {
        console.log(`[TransactionPipelineService] Bulk inserting ${items.length} from email`);

        if (items.length === 0) return [];

        const results = [];

        // Process sequentially to ensure deduplication logic works (one by one)
        // Optimization: In future, can implement bulk-check in Deduplicator
        for (const data of items) {
            try {
                const res = await this.insertFromEmail(userId, data);
                // Handle mixed return type (Transaction object OR { id, isDuplicate })
                const isDuplicate = res && 'isDuplicate' in res ? (res as any).isDuplicate : false;

                if (res && res.id && !isDuplicate) {
                    results.push(res);
                }
            } catch (err) {
                logger.error(`[TransactionPipelineService] Error processing bulk item ${data.emailMessageId}`, err);
            }
        }

        return results;
    }

    private static extractRrnFromRef(ref?: string): string | undefined {
        if (!ref) return undefined;
        // Basic heuristic: if ref matches RRN pattern (12 chars alnum)
        if (/^[a-zA-Z0-9]{12}$/.test(ref)) return ref;
        return undefined;
    }

    /**
     * Insert a transaction from PDF Statement processing
     */
    static async insertFromPdf(userId: string, data: PdfTransactionData) {
        logger.debug(`[TransactionPipelineService] Inserting from PDF for user ${userId}`);

        const components = {
            amount: data.amount,
            merchant: data.merchant,
            date: data.date,
            bankDomain: data.bankName, // Use bank name as domain proxy
            direction: 'debit' as const, // Default to debit for Statements usually
            rrn: undefined, // PDF parsing often lacks RRN, but if found, add it
            // We could parse RRN from description if needed
        };

        const txnFingerprint = TransactionDeduplicator.generateFingerprint(components);

        const txDate = dayjs(data.date);

        // Use Deduplicator
        const result = await TransactionDeduplicator.getOrCreate(
            userId,
            txnFingerprint,
            components,
            async () => {
                const inserted = await TransactionRepository.create({
                    userId,
                    instrumentType: 'BANK', // or CREDIT_CARD depending on context
                    instrumentId: undefined, // Need to link to account eventually
                    transactionDate: new Date(data.date),
                    merchant: data.merchant,
                    category: data.category || 'Uncategorized',
                    amount: data.amount,
                    transactionType: 'pdf_statement',
                    direction: 'debit', // Assume debit for now
                    billMonth: txDate.month() + 1,
                    billYear: txDate.year(),
                    txnFingerprint,
                    isManuallyAdded: false,
                    metadata: {
                        source: 'PDF_STATEMENT',
                        originalDescription: data.description,
                        bank: data.bankName,
                        confidence: data.confidence
                    },
                    classificationMethod: 'img_pdf_parser',
                    referenceNumber: undefined
                });
                return inserted ? inserted.id : null;
            }
        );

        if (result.isNew) {
            await invalidateTransactionCache(userId);
            logger.info(`[TransactionPipelineService] Created new PDF transaction: ${result.transactionId}`);
        } else {
            logger.info(`[TransactionPipelineService] PDF Transaction matched existing: ${result.transactionId} (Strategy: ${result.mergeStrategy})`);
            // TODO: Could update metadata to say "Confirmed by PDF"
        }

        return result;
    }
}

export interface PdfTransactionData {
    amount: number;
    date: string;
    merchant: string;
    description: string;
    bankName: string;
    category?: string;
    confidence?: number;
}



