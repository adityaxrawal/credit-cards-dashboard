
import { query } from '../lib/db';
import { ReconciliationHistoryRecord, ReconciliationStatus } from '../types/reconciliation.types';
import { PoolClient } from 'pg';

export class ReconciliationRepository {
    private static getRunner(client?: PoolClient) {
        return client ? client.query.bind(client) : query;
    }

    static async create(data: {
        userId: string;
        instrumentId: string;
        statementDate: Date;
        statementBalance: number;
        calculatedBalance: number;
        difference: number;
        status: ReconciliationStatus;
        notes?: string;
    }, client?: PoolClient): Promise<ReconciliationHistoryRecord> {
        const runQuery = this.getRunner(client);
        const result = await runQuery(
            `INSERT INTO reconciliation_history (
                user_id, instrument_id, statement_date, 
                statement_balance, calculated_balance, difference, 
                status, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (instrument_id, statement_date) 
            DO UPDATE SET 
                statement_balance = $4,
                calculated_balance = $5,
                difference = $6,
                status = $7,
                notes = $8,
                created_at = NOW()
            RETURNING *`,
            [
                data.userId,
                data.instrumentId,
                data.statementDate,
                data.statementBalance,
                data.calculatedBalance,
                data.difference,
                data.status,
                data.notes
            ]
        );

        return this.mapRowToRecord(result.rows[0]);
    }

    static async findByInstrumentAndDate(
        userId: string,
        instrumentId: string,
        date: Date
    ): Promise<ReconciliationHistoryRecord | null> {
        const result = await query(
            `SELECT * FROM reconciliation_history 
             WHERE user_id = $1 AND instrument_id = $2 AND statement_date = $3`,
            [userId, instrumentId, date]
        );

        if (result.rows.length === 0) return null;
        return this.mapRowToRecord(result.rows[0]);
    }

    static async getHistory(
        userId: string,
        instrumentId: string,
        limit: number = 10
    ): Promise<ReconciliationHistoryRecord[]> {
        const result = await query(
            `SELECT * FROM reconciliation_history 
             WHERE user_id = $1 AND instrument_id = $2
             ORDER BY statement_date DESC
             LIMIT $3`,
            [userId, instrumentId, limit]
        );

        return result.rows.map(row => this.mapRowToRecord(row));
    }

    private static mapRowToRecord(row: any): ReconciliationHistoryRecord {
        return {
            id: row.id,
            userId: row.user_id,
            instrumentId: row.instrument_id,
            statementDate: new Date(row.statement_date),
            statementBalance: parseFloat(row.statement_balance),
            calculatedBalance: parseFloat(row.calculated_balance),
            difference: parseFloat(row.difference),
            status: row.status as ReconciliationStatus,
            notes: row.notes,
            createdAt: new Date(row.created_at)
        };
    }
}
