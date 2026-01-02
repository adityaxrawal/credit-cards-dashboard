/**
 * Accounts Repository
 * Data access layer for bank accounts/instruments and balance history
 */

import { query } from '@shared/database/db';

export interface AccountRow {
    id: string;
    user_id: string;
    type: string;
    bank_id: string | null;
    name: string;
    identifier: string | null;
    last4: string | null;
    balance: number;
    available_balance: number | null;
    currency: string;
    status: string;
    is_primary: boolean;
    interest_rate: number | null;
    opening_balance: number | null;
    provider_name: string | null;
    is_frozen: boolean;
    closed_at: Date | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
    // Joined fields
    bank_name?: string;
    bank_logo?: string;
}

export interface BalanceHistoryRow {
    id: string;
    instrument_id: string;
    user_id: string;
    snapshot_date: string;
    balance: number;
    available_balance: number | null;
    is_reconciled: boolean;
    reconciled_at: Date | null;
    notes: string | null;
}

export class AccountsRepository {
    /**
     * Get all accounts for user with optional filters (with bank join)
     */
    static async findAll(userId: string, filters: { type?: string; status?: string } = {}): Promise<AccountRow[]> {
        let sql = `
            SELECT 
                i.*,
                b.name as bank_name,
                b.logo_url as bank_logo
            FROM instruments i
            LEFT JOIN banks b ON i.bank_id = b.id
            WHERE i.user_id = $1
        `;
        const params: any[] = [userId];
        let idx = 2;

        if (filters.type) {
            sql += ` AND i.type = $${idx++}`;
            params.push(filters.type);
        }
        if (filters.status) {
            sql += ` AND i.status = $${idx++}`;
            params.push(filters.status);
        } else {
            sql += ` AND i.status != 'closed'`;
        }

        sql += ` ORDER BY i.is_primary DESC, i.name ASC`;
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Get account by ID (with bank join)
     */
    static async findById(userId: string, accountId: string): Promise<AccountRow | null> {
        const result = await query(
            `SELECT 
                i.*,
                b.name as bank_name,
                b.logo_url as bank_logo
            FROM instruments i
            LEFT JOIN banks b ON i.bank_id = b.id
            WHERE i.id = $1 AND i.user_id = $2`,
            [accountId, userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Create a new account
     */
    static async create(data: {
        userId: string;
        type: string;
        name: string;
        bankId?: string;
        identifier?: string;
        last4?: string;
        balance?: number;
        availableBalance?: number;
        currency?: string;
        interestRate?: number;
        openingBalance?: number;
        providerName?: string;
        metadata?: any;
    }): Promise<AccountRow> {
        const result = await query(
            `INSERT INTO instruments (
                user_id, type, bank_id, name, identifier, last4, 
                balance, available_balance, currency, interest_rate, 
                opening_balance, provider_name, metadata, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
            RETURNING *`,
            [
                data.userId,
                data.type,
                data.bankId || null,
                data.name,
                data.identifier || null,
                data.last4 || null,
                data.balance || 0,
                data.availableBalance || data.balance || 0,
                data.currency || 'INR',
                data.interestRate || null,
                data.openingBalance || data.balance || 0,
                data.providerName || null,
                data.metadata ? JSON.stringify(data.metadata) : '{}',
            ]
        );
        return result.rows[0];
    }

    /**
     * Update an account
     */
    static async update(accountId: string, userId: string, data: {
        name?: string;
        bankId?: string;
        identifier?: string;
        last4?: string;
        currency?: string;
        interestRate?: number;
        providerName?: string;
        metadata?: any;
    }): Promise<AccountRow | null> {
        const result = await query(
            `UPDATE instruments SET
                name = COALESCE($3, name),
                bank_id = COALESCE($4, bank_id),
                identifier = COALESCE($5, identifier),
                last4 = COALESCE($6, last4),
                currency = COALESCE($7, currency),
                interest_rate = COALESCE($8, interest_rate),
                provider_name = COALESCE($9, provider_name),
                metadata = COALESCE($10::jsonb, metadata),
                updated_at = NOW()
            WHERE id = $1 AND user_id = $2
            RETURNING *`,
            [
                accountId,
                userId,
                data.name,
                data.bankId,
                data.identifier,
                data.last4,
                data.currency,
                data.interestRate,
                data.providerName,
                data.metadata ? JSON.stringify(data.metadata) : null,
            ]
        );
        return result.rows[0] || null;
    }

    /**
     * Soft delete an account
     */
    static async softDelete(accountId: string, userId: string): Promise<void> {
        await query(
            `UPDATE instruments 
             SET status = 'closed', closed_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND user_id = $2`,
            [accountId, userId]
        );
    }

    /**
     * Update account balance
     */
    static async updateBalance(accountId: string, userId: string, newBalance: number): Promise<AccountRow | null> {
        const result = await query(
            `UPDATE instruments 
             SET balance = $3, available_balance = $3, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [accountId, userId, newBalance]
        );
        return result.rows[0] || null;
    }

    /**
     * Toggle freeze status
     */
    static async toggleFreeze(accountId: string, userId: string, freeze: boolean): Promise<AccountRow | null> {
        const result = await query(
            `UPDATE instruments 
             SET is_frozen = $3, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [accountId, userId, freeze]
        );
        return result.rows[0] || null;
    }

    /**
     * Get accounts summary with aggregates
     */
    static async getSummary(userId: string): Promise<any[]> {
        const result = await query(
            `SELECT type, COUNT(*) as count, SUM(COALESCE(balance, 0)) as total_balance
             FROM instruments
             WHERE user_id = $1 AND status = 'active'
             GROUP BY type`,
            [userId]
        );
        return result.rows;
    }

    /**
     * Get total loans outstanding
     */
    static async getLoansOutstanding(userId: string): Promise<number> {
        const result = await query(
            `SELECT COALESCE(SUM(current_outstanding), 0) as total
             FROM loans WHERE user_id = $1 AND status = 'active'`,
            [userId]
        );
        return parseFloat(result.rows[0]?.total) || 0;
    }

    /**
     * Get balance history for an account
     */
    static async getBalanceHistory(
        accountId: string,
        userId: string,
        options: { startDate?: string; endDate?: string } = {}
    ): Promise<BalanceHistoryRow[]> {
        let sql = `SELECT * FROM accounts_balance_history WHERE instrument_id = $1 AND user_id = $2`;
        const params: any[] = [accountId, userId];
        let idx = 3;

        if (options.startDate) {
            sql += ` AND snapshot_date >= $${idx++}`;
            params.push(options.startDate);
        }
        if (options.endDate) {
            sql += ` AND snapshot_date <= $${idx++}`;
            params.push(options.endDate);
        }

        sql += ` ORDER BY snapshot_date DESC LIMIT 100`;
        const result = await query(sql, params);
        return result.rows;
    }

    /**
     * Create or update balance snapshot
     */
    static async upsertBalanceSnapshot(
        accountId: string,
        userId: string,
        snapshotDate: string,
        balance: number,
        notes?: string
    ): Promise<BalanceHistoryRow> {
        const result = await query(
            `INSERT INTO accounts_balance_history (
                instrument_id, user_id, snapshot_date, balance, notes
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (instrument_id, snapshot_date) 
            DO UPDATE SET balance = $4, notes = COALESCE($5, accounts_balance_history.notes)
            RETURNING *`,
            [accountId, userId, snapshotDate, balance, notes || null]
        );
        return result.rows[0];
    }

    /**
     * Reconcile account for a date
     */
    static async reconcile(
        accountId: string,
        userId: string,
        snapshotDate: string,
        notes?: string
    ): Promise<BalanceHistoryRow> {
        const result = await query(
            `INSERT INTO accounts_balance_history (
                instrument_id, user_id, snapshot_date, balance, available_balance,
                is_reconciled, reconciled_at, notes
            )
            SELECT $1, $2, $3, balance, available_balance, true, NOW(), $4
            FROM instruments WHERE id = $1
            ON CONFLICT (instrument_id, snapshot_date) 
            DO UPDATE SET 
                is_reconciled = true, 
                reconciled_at = NOW(),
                notes = COALESCE($4, accounts_balance_history.notes)
            RETURNING *`,
            [accountId, userId, snapshotDate, notes || null]
        );
        return result.rows[0];
    }
}
