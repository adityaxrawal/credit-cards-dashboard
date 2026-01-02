/**
 * Transaction Pipeline Service
 * Email/bulk ingestion operations
 * 
 * Extracted from TransactionService as part of Issue #4 CQRS-lite decomposition
 */

import { TransactionRepository } from '../../repositories/TransactionRepository';
import dayjs from 'dayjs';
import { createHash } from 'crypto';
import { TransactionMetadata } from '../../types/transaction.types';
import { invalidateTransactionCache } from '../../utils/cache/cacheInvalidation';

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
}

export class TransactionPipelineService {
    /**
     * Insert a transaction from email processing
     */
    static async insertFromEmail(userId: string, data: EmailTransactionData) {
        console.log(`[TransactionPipelineService] Inserting from email for user ${userId}`);

        // Create fingerprint for deduplication
        const txnFingerprint = this.generateFingerprint(
            data.emailMessageId,
            data.transactionDate,
            data.amount,
            data.merchant
        );

        const txDate = dayjs(data.transactionDate);
        const billMonth = txDate.month() + 1;
        const billYear = txDate.year();

        // Check for duplicate
        const existing = await TransactionRepository.findByFingerprint(userId, txnFingerprint);
        if (existing) {
            console.log(`[TransactionPipelineService] Skipping duplicate ${txnFingerprint}`);
            return existing;
        }

        const result = await TransactionRepository.create({
            userId,
            instrumentType: data.instrumentType,
            instrumentId: data.instrumentId || data.cardId, // Handle legacy cardId
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
        });

        if (result) {
            await invalidateTransactionCache(userId);
        }
        return result;
    }

    /**
     * Bulk insert transactions from email processing
     */
    static async insertFromEmailBulk(userId: string, items: EmailTransactionData[]) {
        console.log(`[TransactionPipelineService] Bulk inserting ${items.length} from email`);

        if (items.length === 0) return [];

        const transactionsToCreate = items.map(data => {
            const txnFingerprint = this.generateFingerprint(
                data.emailMessageId,
                data.transactionDate,
                data.amount,
                data.merchant
            );

            const txDate = dayjs(data.transactionDate);
            const billMonth = txDate.month() + 1;
            const billYear = txDate.year();

            return {
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
                rawExtraction: data.rawExtraction,
                classificationMethod: data.classificationMethod,
                exactTimestamp: data.exactTimestamp,
                emailSubject: data.emailSubject,
                gmailThreadId: data.gmailThreadId,
                currencyCode: data.currencyCode,
                referenceNumber: data.referenceNumber,
                transactionSubtype: data.transactionSubtype,
                scanJobId: data.scanJobId,
            };
        });

        // Filter out duplicates
        const fingerprints = transactionsToCreate.map(t => t.txnFingerprint);
        // Ensure getExistingFingerprints exists or use replacement
        const existingFingerprints = await TransactionRepository.getExistingFingerprints(userId, fingerprints);
        const newTransactions = transactionsToCreate.filter(t => !existingFingerprints.includes(t.txnFingerprint));

        if (newTransactions.length === 0) {
            console.log('[TransactionPipelineService] No new transactions (all duplicates)');
            return [];
        }

        await TransactionRepository.batchCreate(newTransactions);

        if (newTransactions.length > 0) {
            await invalidateTransactionCache(userId);
        }

        return newTransactions;
    }

    /**
     * Generate fingerprint for deduplication
     */
    private static generateFingerprint(
        emailMessageId: string,
        transactionDate: Date,
        amount: number,
        merchant: string
    ): string {
        const data = `${emailMessageId}-${transactionDate.toISOString()}-${amount}-${merchant}`;
        return createHash('sha256').update(data).digest('hex');
    }
}
