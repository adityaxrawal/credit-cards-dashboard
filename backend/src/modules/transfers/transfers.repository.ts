/**
 * Transfer Repository
 * Data access layer for internal transfers between accounts
 */

import pool, { query } from '@shared/database/db';

export class TransferRepository {
    /**
     * Create a transfer pair (debit and credit transactions)
     */
    static async createTransfer(
        userId: string,
        fromAccountId: string,
        toAccountId: string,
        amount: number,
        description: string,
        txnDate: string,
        pairId: string
    ): Promise<{ debit: any; credit: any }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create debit transaction
            const debitResult = await client.query(
                `INSERT INTO transactions (
                    user_id, instrument_id, amount, direction, type, category,
                    description, transaction_date, is_transfer, transfer_pair_id, transfer_type
                ) VALUES ($1, $2, $3, 'debit', 'transfer', 'Transfer', $4, $5, true, $6, 'internal')
                RETURNING *`,
                [userId, fromAccountId, amount, description, txnDate, pairId]
            );

            // Create credit transaction
            const creditResult = await client.query(
                `INSERT INTO transactions (
                    user_id, instrument_id, amount, direction, type, category,
                    description, transaction_date, is_transfer, transfer_pair_id, transfer_type
                ) VALUES ($1, $2, $3, 'credit', 'transfer', 'Transfer', $4, $5, true, $6, 'internal')
                RETURNING *`,
                [userId, toAccountId, amount, description, txnDate, pairId]
            );

            // Update account balances
            await client.query(
                `UPDATE instruments SET balance = balance - $1 WHERE id = $2 AND user_id = $3`,
                [amount, fromAccountId, userId]
            );
            await client.query(
                `UPDATE instruments SET balance = balance + $1 WHERE id = $2 AND user_id = $3`,
                [amount, toAccountId, userId]
            );

            await client.query('COMMIT');

            return {
                debit: debitResult.rows[0],
                credit: creditResult.rows[0],
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Find potential transfer matches
     */
    static async findPotentialTransfers(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT 
                d.id as debit_id,
                d.amount as debit_amount,
                d.transaction_date as debit_date,
                d.instrument_id as debit_account,
                c.id as credit_id,
                c.amount as credit_amount,
                c.transaction_date as credit_date,
                c.instrument_id as credit_account
             FROM transactions d
             JOIN transactions c ON 
                d.user_id = c.user_id AND
                d.amount = c.amount AND
                d.direction = 'debit' AND
                c.direction = 'credit' AND
                d.instrument_id != c.instrument_id AND
                ABS(EXTRACT(EPOCH FROM (d.transaction_date - c.transaction_date))) <= 86400 * 3 AND
                d.is_transfer IS NOT TRUE AND
                c.is_transfer IS NOT TRUE AND
                d.transfer_pair_id IS NULL AND
                c.transfer_pair_id IS NULL
             WHERE d.user_id = $1
             ORDER BY d.transaction_date DESC
             LIMIT 50`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Link two transactions as transfer pair
     */
    static async linkAsTransfer(userId: string, debitTxnId: string, creditTxnId: string, pairId: string): Promise<void> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE transactions 
                 SET is_transfer = true, transfer_pair_id = $1, transfer_type = 'matched'
                 WHERE id = $2 AND user_id = $3`,
                [pairId, debitTxnId, userId]
            );

            await client.query(
                `UPDATE transactions 
                 SET is_transfer = true, transfer_pair_id = $1, transfer_type = 'matched'
                 WHERE id = $2 AND user_id = $3`,
                [pairId, creditTxnId, userId]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get transfer history
     */
    static async getTransferHistory(userId: string, limit: number): Promise<any[]> {
        const result = await query(
            `SELECT 
                t1.id as debit_id,
                t1.amount,
                t1.transaction_date,
                t1.description,
                t1.transfer_pair_id,
                t1.instrument_id as from_account_id,
                i1.name as from_account_name,
                t2.instrument_id as to_account_id,
                i2.name as to_account_name
             FROM transactions t1
             JOIN transactions t2 ON t1.transfer_pair_id = t2.transfer_pair_id AND t1.id != t2.id
             JOIN instruments i1 ON t1.instrument_id = i1.id
             JOIN instruments i2 ON t2.instrument_id = i2.id
             WHERE t1.user_id = $1 
               AND t1.is_transfer = true 
               AND t1.direction = 'debit'
             ORDER BY t1.transaction_date DESC
             LIMIT $2`,
            [userId, limit]
        );
        return result.rows;
    }
}
