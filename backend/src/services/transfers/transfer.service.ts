import pool from '../../lib/db';
import { format, parseISO } from 'date-fns';

export interface TransferInput {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date?: string;
    description?: string;
    notes?: string;
}

export interface TransferMatch {
    debitTransactionId: string;
    creditTransactionId: string;
    matchConfidence: number;
    matchReason: string;
}

export class TransferService {
    /**
     * Create an internal transfer between two accounts
     */
    async createTransfer(userId: string, input: TransferInput): Promise<{ debit: any; credit: any; pairId: string }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Generate transfer pair ID
            const pairId = `TRF-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const txnDate = input.date || new Date().toISOString().split('T')[0];

            // Create debit transaction (from account)
            const debitResult = await client.query(
                `INSERT INTO transactions (
          user_id, instrument_id, amount, direction, type, category,
          description, transaction_date, is_transfer, transfer_pair_id, transfer_type
        ) VALUES ($1, $2, $3, 'debit', 'transfer', 'Transfer',
          $4, $5, true, $6, 'internal')
        RETURNING *`,
                [userId, input.fromAccountId, input.amount, input.description || 'Internal Transfer', txnDate, pairId]
            );

            // Create credit transaction (to account)
            const creditResult = await client.query(
                `INSERT INTO transactions (
          user_id, instrument_id, amount, direction, type, category,
          description, transaction_date, is_transfer, transfer_pair_id, transfer_type
        ) VALUES ($1, $2, $3, 'credit', 'transfer', 'Transfer',
          $4, $5, true, $6, 'internal')
        RETURNING *`,
                [userId, input.toAccountId, input.amount, input.description || 'Internal Transfer', txnDate, pairId]
            );

            // Update account balances
            await client.query(
                `UPDATE instruments SET balance = balance - $1 WHERE id = $2 AND user_id = $3`,
                [input.amount, input.fromAccountId, userId]
            );
            await client.query(
                `UPDATE instruments SET balance = balance + $1 WHERE id = $2 AND user_id = $3`,
                [input.amount, input.toAccountId, userId]
            );

            await client.query('COMMIT');

            return {
                debit: debitResult.rows[0],
                credit: creditResult.rows[0],
                pairId,
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Find unmatched transactions that could be transfers
     */
    async findPotentialTransfers(userId: string): Promise<TransferMatch[]> {
        const query = `
      SELECT 
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
      LIMIT 50
    `;

        const result = await pool.query(query, [userId]);

        return result.rows.map(row => ({
            debitTransactionId: row.debit_id,
            creditTransactionId: row.credit_id,
            matchConfidence: this.calculateConfidence(row),
            matchReason: this.getMatchReason(row),
        }));
    }

    /**
     * Link two transactions as a transfer pair
     */
    async linkAsTransfer(userId: string, debitTxnId: string, creditTxnId: string): Promise<{ pairId: string }> {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const pairId = `TRF-${Date.now()}-${Math.random().toString(36).substring(7)}`;

            // Update both transactions
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
            return { pairId };
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
    async getTransferHistory(userId: string, limit: number = 50): Promise<any[]> {
        const query = `
      SELECT 
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
      LIMIT $2
    `;

        const result = await pool.query(query, [userId, limit]);
        return result.rows;
    }

    private calculateConfidence(row: any): number {
        let confidence = 0.5; // Base confidence for amount match

        // Same day = higher confidence
        const daysDiff = Math.abs(
            (new Date(row.debit_date).getTime() - new Date(row.credit_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff === 0) confidence += 0.3;
        else if (daysDiff <= 1) confidence += 0.2;
        else confidence += 0.1;

        return Math.min(confidence, 1);
    }

    private getMatchReason(row: any): string {
        const daysDiff = Math.abs(
            (new Date(row.debit_date).getTime() - new Date(row.credit_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) {
            return `Same amount (₹${row.debit_amount}) debited and credited on the same day`;
        } else {
            return `Same amount (₹${row.debit_amount}) within ${Math.round(daysDiff)} day(s)`;
        }
    }
}
