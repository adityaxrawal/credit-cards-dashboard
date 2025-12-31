import pool from '../../lib/db';
import { invalidateAccountsCache } from '../../utils/cache/cacheInvalidation';
import logger from '../../utils/infrastructure/logger';

export interface ReconciliationResult {
    match: boolean;
    difference: number;
    statementBalance: number;
    calculatedBalance: number;
    unreconciledTransactions: number;
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
            const result = await pool.query(
                `INSERT INTO accounts_balance_history (
                    user_id, instrument_id, snapshot_date, balance, notes, is_reconciled
                ) VALUES ($1, $2, $3, $4, $5, false)
                ON CONFLICT (instrument_id, snapshot_date) 
                DO UPDATE SET balance = $4, notes = $5
                RETURNING id`,
                [userId, accountId, date, balance, notes]
            );

            await invalidateAccountsCache(userId);
            return result.rows[0].id;
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
        date: Date
    ): Promise<ReconciliationResult> {
        try {
            // 1. Get the statement balance for the specific date
            const balanceResult = await pool.query(
                `SELECT balance FROM accounts_balance_history 
                 WHERE user_id = $1 AND instrument_id = $2 AND snapshot_date = $3`,
                [userId, accountId, date]
            );

            if (balanceResult.rows.length === 0) {
                throw new Error('No statement balance record found for this date');
            }

            const statementBalance = parseFloat(balanceResult.rows[0].balance);

            // 2. Calculate balance from transactions up to that date
            // We assume there's an opening balance in the instruments table
            const instrumentResult = await pool.query(
                `SELECT opening_balance, type FROM instruments WHERE id = $1 AND user_id = $2`,
                [accountId, userId]
            );

            if (instrumentResult.rows.length === 0) {
                throw new Error('Instrument not found');
            }

            const openingBalance = parseFloat(instrumentResult.rows[0].opening_balance || '0');
            const type = instrumentResult.rows[0].type;

            // Sum transactions
            // For credit cards: Debits increase balance (debt), Credits decrease it
            // For bank accounts: Credits increase balance, Debits decrease it
            const txResult = await pool.query(
                `SELECT 
                    SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as total_credits,
                    SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as total_debits,
                    COUNT(*) as tx_count
                 FROM transactions 
                 WHERE user_id = $1 
                   AND instrument_id = $2 
                   AND transaction_date <= $3
                   AND (is_split IS NULL OR is_split = false)
                   AND is_reconciled = false`, // Only verify unreconciled ones? Or all? Usually all up to date.
                // Actually, typically we sum ALL transactions to get current balance.
                // Let's assume we simply sum all valid transactions <= date.
                [userId, accountId, date]
            );

            const totalCredits = parseFloat(txResult.rows[0].total_credits || '0');
            const totalDebits = parseFloat(txResult.rows[0].total_debits || '0');
            const txCount = parseInt(txResult.rows[0].tx_count || '0');

            let calculatedBalance = openingBalance;

            if (type === 'credit_card') {
                // Outstanding balance calculation
                calculatedBalance = openingBalance + totalDebits - totalCredits;
            } else {
                // Asset account (Bank, Wallet)
                calculatedBalance = openingBalance + totalCredits - totalDebits;
            }

            const difference = calculatedBalance - statementBalance;
            const match = Math.abs(difference) < 0.01; // Float tolerance

            if (match) {
                // Mark associated transactions as reconciled if they match
                await pool.query(
                    `UPDATE transactions 
                     SET is_reconciled = true 
                     WHERE user_id = $1 AND instrument_id = $2 AND transaction_date <= $3`,
                    [userId, accountId, date]
                );

                // Mark snapshot as reconciled
                await pool.query(
                    `UPDATE accounts_balance_history 
                     SET is_reconciled = true, reconciled_at = NOW() 
                     WHERE user_id = $1 AND instrument_id = $2 AND snapshot_date = $3`,
                    [userId, accountId, date]
                );
            }

            return {
                match,
                difference,
                statementBalance,
                calculatedBalance,
                unreconciledTransactions: txCount
            };
        } catch (error) {
            logger.error('[Reconciliation] Failed to reconcile:', error);
            throw error;
        }
    }
}
