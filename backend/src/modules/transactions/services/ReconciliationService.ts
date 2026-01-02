import { executeTransaction } from '@shared/database/db';
import { invalidateAccountsCache } from '@shared/utils/cache/cacheInvalidation';
import logger from '@shared/utils/infrastructure/logger';
import { BalanceHistoryRepository } from '@repositories/BalanceHistoryRepository';
import { InstrumentRepository } from '@repositories/InstrumentRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { ReconciliationRepository } from '@repositories/ReconciliationRepository';
import { ReconciliationStatus } from '@shared/types/reconciliation.types';

export interface ReconciliationResult {
    match: boolean;
    difference: number;
    statementBalance: number;
    calculatedBalance: number;
    unreconciledTransactions: number;
    status: ReconciliationStatus;
    reconciliationId?: string;
}

export interface ReconciliationOptions {
    tolerance?: number;
    partialTolerance?: number;
    autoReconcile?: boolean;
}

export class ReconciliationService {
    /**
     * Record a statement balance snapshot for an account
     */
    static async recordStatementBalance(
        userId: string,
        accountId: string,
        date: Date,
        balance: number,
        notes?: string
    ): Promise<string> {
        try {
            const id = await BalanceHistoryRepository.recordSnapshot(userId, accountId, date, balance, 'statement', notes);
            await invalidateAccountsCache(userId);
            return id;
        } catch (error) {
            logger.error('[Reconciliation] Failed to record statement balance:', error);
            throw error;
        }
    }

    /**
     * Reconcile an account against a recorded statement balance
     */
    static async reconcile(
        userId: string,
        accountId: string,
        date: Date,
        options: ReconciliationOptions = {}
    ): Promise<ReconciliationResult> {
        return executeTransaction(async (client) => {
            try {
                // Options defaults
                const tolerance = options.tolerance ?? 0.05; // Default 5 cents tolerance
                const partialTolerance = options.partialTolerance ?? 10.00; // Default $10 for partial match

                // 0. Adjust date to end of day to include all transactions on that date
                const reconciliationDate = new Date(date);
                reconciliationDate.setHours(23, 59, 59, 999);

                // 1. Get the statement balance for the specific date
                const snapshot = await BalanceHistoryRepository.getSnapshot(userId, accountId, date, client);

                if (!snapshot) {
                    throw new Error('No statement balance record found for this date');
                }

                const statementBalance = snapshot.balance;

                // 2. Calculate balance from transactions up to that date
                // Note: Reading instrument outside transaction is acceptable (config data)
                const instrument = await InstrumentRepository.findById(accountId);

                if (!instrument || instrument.userId !== userId) {
                    throw new Error('Instrument not found');
                }

                const openingBalance = await InstrumentRepository.getOpeningBalance(accountId) || 0;
                const type = instrument.type;

                // Sum transactions using the transaction client
                const stats = await TransactionRepository.getBalanceStats(userId, accountId, reconciliationDate, client);

                const totalCredits = stats.totalCredits;
                const totalDebits = stats.totalDebits;
                const txCount = stats.txCount;

                let calculatedBalance = openingBalance;

                if (type === 'credit_card') {
                    // Outstanding balance calculation
                    calculatedBalance = openingBalance + totalDebits - totalCredits;
                } else {
                    // Asset account (Bank, Wallet)
                    calculatedBalance = openingBalance + totalCredits - totalDebits;
                }

                const difference = calculatedBalance - statementBalance;
                const absDiff = Math.abs(difference);

                // 3. Determine Status
                let status: ReconciliationStatus;
                let match = false;

                if (absDiff <= tolerance) {
                    status = ReconciliationStatus.MATCHED;
                    match = true;
                } else if (absDiff <= partialTolerance) {
                    status = ReconciliationStatus.PARTIAL_MATCH;
                    match = false; // Strictly not a match for automation purposes, but flagged as partial
                } else {
                    status = ReconciliationStatus.MISMATCH;
                    match = false;
                }

                // 4. Record History (Atomic)
                const historyRecord = await ReconciliationRepository.create({
                    userId,
                    instrumentId: accountId,
                    statementDate: date,
                    statementBalance,
                    calculatedBalance,
                    difference,
                    status,
                    notes: `Auto-reconciliation: ${status}`
                }, client);

                // 5. Action based on status (Atomic)
                if (status === ReconciliationStatus.MATCHED) {
                    // Mark associated transactions as reconciled if they match
                    await TransactionRepository.markReconciled(userId, accountId, reconciliationDate, client);

                    // Mark snapshot as reconciled
                    await BalanceHistoryRepository.markReconciled(userId, accountId, date, client);
                }

                return {
                    match,
                    difference,
                    statementBalance,
                    calculatedBalance,
                    unreconciledTransactions: txCount,
                    status,
                    reconciliationId: historyRecord.id
                };
            } catch (error) {
                logger.error('[Reconciliation] Failed to reconcile:', error);
                throw error;
            }
        });
    }
}
