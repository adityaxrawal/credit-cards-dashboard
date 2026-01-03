/**
 * TransactionsFlushStrategy
 * 
 * Handles flushing transaction records to the database.
 * Contains the full mapping logic for transaction data.
 * Extracted from DbWriteQueueManager as part of Strategy Pattern refactoring.
 */

import { FlushStrategy } from './FlushStrategy';
import { DbWriteJob, DbWriteTable } from '../DbWriteQueueManager';
import { TransactionRepository } from '@modules/transactions/repositories/TransactionRepository';
import logger from '@shared/utils/infrastructure/logger';

export class TransactionsFlushStrategy implements FlushStrategy {
    readonly table: DbWriteTable = 'transactions';

    async flush(jobs: DbWriteJob[]): Promise<void> {
        if (jobs.length === 0) return;

        try {
            // Map jobs to the expected format for TransactionRepository
            const transactionsData = jobs.map(job => {
                const d = job.data;
                // Ensure explicit casting/conversion where necessary
                return {
                    id: d.id as string,
                    userId: d.userId as string,
                    instrumentType: (d.instrumentType as string) || null,
                    instrumentId: d.instrumentId as string | undefined,
                    cardId: d.cardId as string | undefined,
                    transactionDate: new Date(d.transactionDate as string | number | Date),
                    merchant: d.merchant as string,
                    category: d.category as string,
                    amount: Number(d.amount),
                    transactionType: d.transactionType as string,
                    direction: d.direction as 'credit' | 'debit',
                    counterpartyName: d.counterpartyName as string | undefined,
                    counterpartyIdentifier: d.counterpartyIdentifier as string | undefined,
                    referenceNumber: d.referenceNumber as string | undefined,
                    description: d.description as string | undefined,
                    billMonth: d.billMonth as number | undefined,
                    billYear: d.billYear as number | undefined,
                    emailMessageId: d.emailMessageId as string | undefined,
                    emailSubject: d.emailSubject as string | undefined,
                    emailSender: d.emailSender as string | undefined,
                    txnFingerprint: d.txnFingerprint as string | undefined,
                    isManuallyAdded: (d.isManuallyAdded as boolean) ?? false,
                    metadata: d.metadata as any,
                    exactTimestamp: d.exactTimestamp ? new Date(d.exactTimestamp as string | number | Date) : undefined,
                    gmailThreadId: d.gmailThreadId as string | undefined,
                    gmailAccountIndex: d.gmailAccountIndex as number | undefined,
                    currencyCode: d.currencyCode as string | undefined,
                    originalAmount: d.originalAmount as number | undefined,
                    transactionSubtype: d.transactionSubtype as string | undefined,
                    classificationMethod: d.classificationMethod as string | undefined,
                    confidenceScore: d.confidenceScore as number | undefined,
                    needsReview: d.needsReview as boolean | undefined,
                    reviewReason: d.reviewReason as string | undefined,
                    rawExtraction: d.rawExtraction as any,
                    scanJobId: d.scanJobId as string | undefined,
                    rawEmailId: d.rawEmailId as string | undefined,
                    trustScore: d.trustScore as number | undefined,
                    originalCurrency: d.originalCurrency as string | undefined,
                    exchangeRate: d.exchangeRate as number | undefined,
                    conversionSkipped: d.conversionSkipped as boolean | undefined,
                };
            });

            await TransactionRepository.batchCreate(transactionsData);

            logger.debug(`[DbWriteQueue:transactions] Flushed ${jobs.length} items via batch insert`);
        } catch (error) {
            // Re-throw to trigger retry logic in base class
            throw error;
        }
    }
}
