
import { query } from '@shared/database/db';
import { PoolClient } from 'pg';

export interface BalanceSnapshot {
    id: string;
    userId: string;
    instrumentId: string;
    snapshotDate: Date;
    balance: number;
    notes?: string;
    isReconciled: boolean;
    reconciledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export class BalanceHistoryRepository {
    private static getRunner(client?: PoolClient) {
        return client ? client.query.bind(client) : query;
    }

    static async recordSnapshot(
        userId: string,
        instrumentId: string,
        date: Date | string,
        balance: number,
        snapshotType: string = 'daily',
        notes?: string
    ): Promise<string> {
        const result = await query(
            `INSERT INTO accounts_balance_history (
                user_id, instrument_id, snapshot_date, balance, notes, is_reconciled, snapshot_type
            ) VALUES ($1, $2, $3, $4, $5, false, $6)
            ON CONFLICT (instrument_id, snapshot_date) 
            DO UPDATE SET balance = $4, notes = $5, snapshot_type = $6, updated_at = NOW()
            RETURNING id`,
            [userId, instrumentId, date, balance, notes, snapshotType]
        );
        return result.rows[0].id;
    }

    static async getSnapshot(
        userId: string,
        instrumentId: string,
        date: Date,
        client?: PoolClient
    ): Promise<BalanceSnapshot | null> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `SELECT * FROM accounts_balance_history 
             WHERE user_id = $1 AND instrument_id = $2 AND snapshot_date = $3`,
            [userId, instrumentId, date]
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            instrumentId: row.instrument_id,
            snapshotDate: row.snapshot_date,
            balance: parseFloat(row.balance),
            notes: row.notes,
            isReconciled: row.is_reconciled,
            reconciledAt: row.reconciled_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    static async markReconciled(
        userId: string,
        instrumentId: string,
        date: Date,
        client?: PoolClient
    ): Promise<void> {
        const runQuery = this.getRunner(client);
        await runQuery(
            `UPDATE accounts_balance_history 
             SET is_reconciled = true, reconciled_at = NOW() 
             WHERE user_id = $1 AND instrument_id = $2 AND snapshot_date = $3`,
            [userId, instrumentId, date]
        );
    }
}
