import pool from '../../lib/db';

export interface AccountInput {
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
    metadata?: Record<string, unknown>;
}

export interface Account {
    id: string;
    userId: string;
    type: string;
    bankId?: string;
    name: string;
    identifier?: string;
    last4?: string;
    balance: number;
    availableBalance?: number;
    currency: string;
    status: string;
    isPrimary: boolean;
    interestRate?: number;
    openingBalance?: number;
    providerName?: string;
    isFrozen: boolean;
    closedAt?: Date;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface BalanceHistoryEntry {
    id: string;
    snapshotDate: string;
    balance: number;
    availableBalance?: number;
    isReconciled: boolean;
    reconciledAt?: Date;
    notes?: string;
}

export interface AccountsSummary {
    totalAccounts: number;
    byType: Record<string, { count: number; totalBalance: number }>;
    totalBalance: number;
    totalLiabilities: number;
    netWorth: number;
}

export class AccountsService {
    /**
     * Get all accounts for a user with optional filtering
     */
    async getAll(
        userId: string,
        filters: { type?: string; status?: string } = {}
    ): Promise<Account[]> {
        let query = `
      SELECT 
        i.*,
        b.name as bank_name,
        b.logo_url as bank_logo
      FROM instruments i
      LEFT JOIN banks b ON i.bank_id = b.id
      WHERE i.user_id = $1
    `;
        const params: unknown[] = [userId];
        let paramIndex = 2;

        if (filters.type) {
            query += ` AND i.type = $${paramIndex++}`;
            params.push(filters.type);
        }

        if (filters.status) {
            query += ` AND i.status = $${paramIndex++}`;
            params.push(filters.status);
        } else {
            query += ` AND i.status != 'closed'`;
        }

        query += ` ORDER BY i.is_primary DESC, i.name ASC`;

        const result = await pool.query(query, params);
        return result.rows.map(this.mapToAccount);
    }

    /**
     * Get account by ID
     */
    async getById(userId: string, accountId: string): Promise<Account | null> {
        const query = `
      SELECT 
        i.*,
        b.name as bank_name,
        b.logo_url as bank_logo
      FROM instruments i
      LEFT JOIN banks b ON i.bank_id = b.id
      WHERE i.id = $1 AND i.user_id = $2
    `;
        const result = await pool.query(query, [accountId, userId]);

        if (result.rows.length === 0) return null;
        return this.mapToAccount(result.rows[0]);
    }

    /**
     * Create a new account
     */
    async create(userId: string, input: AccountInput): Promise<Account> {
        const query = `
      INSERT INTO instruments (
        user_id, type, bank_id, name, identifier, last4, 
        balance, available_balance, currency, interest_rate,
        opening_balance, provider_name, metadata, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active'
      )
      RETURNING *
    `;
        const result = await pool.query(query, [
            userId,
            input.type,
            input.bankId || null,
            input.name,
            input.identifier || null,
            input.last4 || null,
            input.balance || 0,
            input.availableBalance || input.balance || 0,
            input.currency || 'INR',
            input.interestRate || null,
            input.openingBalance || input.balance || 0,
            input.providerName || null,
            JSON.stringify(input.metadata || {}),
        ]);

        // Create initial balance history entry
        await this.createBalanceSnapshot(userId, result.rows[0].id, input.balance || 0);

        return this.mapToAccount(result.rows[0]);
    }

    /**
     * Update an account
     */
    async update(
        userId: string,
        accountId: string,
        input: Partial<AccountInput>
    ): Promise<Account | null> {
        const existing = await this.getById(userId, accountId);
        if (!existing) return null;

        const query = `
      UPDATE instruments SET
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
      RETURNING *
    `;
        const result = await pool.query(query, [
            accountId,
            userId,
            input.name,
            input.bankId,
            input.identifier,
            input.last4,
            input.currency,
            input.interestRate,
            input.providerName,
            input.metadata ? JSON.stringify(input.metadata) : null,
        ]);

        return this.mapToAccount(result.rows[0]);
    }

    /**
     * Soft delete an account
     */
    async delete(userId: string, accountId: string): Promise<void> {
        const query = `
      UPDATE instruments 
      SET status = 'closed', closed_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
        await pool.query(query, [accountId, userId]);
    }

    /**
     * Update account balance manually
     */
    async updateBalance(
        userId: string,
        accountId: string,
        newBalance: number,
        notes?: string
    ): Promise<{ account: Account; snapshot: BalanceHistoryEntry }> {
        // Update balance
        const updateQuery = `
      UPDATE instruments 
      SET balance = $3, available_balance = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
        const result = await pool.query(updateQuery, [accountId, userId, newBalance]);

        if (result.rows.length === 0) {
            throw new Error('Account not found');
        }

        // Create balance history entry
        const snapshot = await this.createBalanceSnapshot(userId, accountId, newBalance, notes);

        return {
            account: this.mapToAccount(result.rows[0]),
            snapshot,
        };
    }

    /**
     * Get balance history for an account
     */
    async getBalanceHistory(
        userId: string,
        accountId: string,
        options: { startDate?: string; endDate?: string } = {}
    ): Promise<BalanceHistoryEntry[]> {
        let query = `
      SELECT * FROM accounts_balance_history
      WHERE instrument_id = $1 AND user_id = $2
    `;
        const params: unknown[] = [accountId, userId];
        let paramIndex = 3;

        if (options.startDate) {
            query += ` AND snapshot_date >= $${paramIndex++}`;
            params.push(options.startDate);
        }

        if (options.endDate) {
            query += ` AND snapshot_date <= $${paramIndex++}`;
            params.push(options.endDate);
        }

        query += ` ORDER BY snapshot_date DESC LIMIT 100`;

        const result = await pool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            snapshotDate: row.snapshot_date,
            balance: parseFloat(row.balance),
            availableBalance: row.available_balance ? parseFloat(row.available_balance) : undefined,
            isReconciled: row.is_reconciled,
            reconciledAt: row.reconciled_at,
            notes: row.notes,
        }));
    }

    /**
     * Mark account as reconciled for a date
     */
    async reconcile(
        userId: string,
        accountId: string,
        date?: string,
        notes?: string
    ): Promise<BalanceHistoryEntry> {
        const snapshotDate = date || new Date().toISOString().split('T')[0];

        const query = `
      INSERT INTO accounts_balance_history (
        instrument_id, user_id, snapshot_date, balance, available_balance,
        is_reconciled, reconciled_at, notes
      )
      SELECT 
        $1, $2, $3, balance, available_balance, true, NOW(), $4
      FROM instruments WHERE id = $1
      ON CONFLICT (instrument_id, snapshot_date) 
      DO UPDATE SET 
        is_reconciled = true, 
        reconciled_at = NOW(),
        notes = COALESCE($4, accounts_balance_history.notes)
      RETURNING *
    `;
        const result = await pool.query(query, [accountId, userId, snapshotDate, notes]);

        const row = result.rows[0];
        return {
            id: row.id,
            snapshotDate: row.snapshot_date,
            balance: parseFloat(row.balance),
            availableBalance: row.available_balance ? parseFloat(row.available_balance) : undefined,
            isReconciled: row.is_reconciled,
            reconciledAt: row.reconciled_at,
            notes: row.notes,
        };
    }

    /**
     * Get accounts summary with totals by type
     */
    async getSummary(userId: string): Promise<AccountsSummary> {
        const query = `
      SELECT 
        type,
        COUNT(*) as count,
        SUM(COALESCE(balance, 0)) as total_balance
      FROM instruments
      WHERE user_id = $1 AND status = 'active'
      GROUP BY type
    `;
        const result = await pool.query(query, [userId]);

        const byType: Record<string, { count: number; totalBalance: number }> = {};
        let totalAccounts = 0;
        let totalBalance = 0;
        let totalLiabilities = 0;

        const liabilityTypes = ['credit_card'];

        for (const row of result.rows) {
            const count = parseInt(row.count);
            const balance = parseFloat(row.total_balance) || 0;

            byType[row.type] = { count, totalBalance: balance };
            totalAccounts += count;

            if (liabilityTypes.includes(row.type)) {
                totalLiabilities += Math.abs(balance);
            } else {
                totalBalance += balance;
            }
        }

        // Get loans outstanding
        const loansQuery = `
      SELECT COALESCE(SUM(current_outstanding), 0) as total
      FROM loans WHERE user_id = $1 AND status = 'active'
    `;
        const loansResult = await pool.query(loansQuery, [userId]);
        const loansOutstanding = parseFloat(loansResult.rows[0]?.total) || 0;
        totalLiabilities += loansOutstanding;

        return {
            totalAccounts,
            byType,
            totalBalance,
            totalLiabilities,
            netWorth: totalBalance - totalLiabilities,
        };
    }

    /**
     * Toggle freeze status on an account
     */
    async toggleFreeze(
        userId: string,
        accountId: string,
        freeze: boolean
    ): Promise<Account> {
        const query = `
      UPDATE instruments 
      SET is_frozen = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
        const result = await pool.query(query, [accountId, userId, freeze]);

        if (result.rows.length === 0) {
            throw new Error('Account not found');
        }

        return this.mapToAccount(result.rows[0]);
    }

    /**
     * Create a balance snapshot entry
     */
    private async createBalanceSnapshot(
        userId: string,
        accountId: string,
        balance: number,
        notes?: string
    ): Promise<BalanceHistoryEntry> {
        const today = new Date().toISOString().split('T')[0];

        const query = `
      INSERT INTO accounts_balance_history (
        instrument_id, user_id, snapshot_date, balance, notes
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (instrument_id, snapshot_date) 
      DO UPDATE SET balance = $4, notes = COALESCE($5, accounts_balance_history.notes)
      RETURNING *
    `;
        const result = await pool.query(query, [accountId, userId, today, balance, notes]);

        const row = result.rows[0];
        return {
            id: row.id,
            snapshotDate: row.snapshot_date,
            balance: parseFloat(row.balance),
            availableBalance: row.available_balance ? parseFloat(row.available_balance) : undefined,
            isReconciled: row.is_reconciled,
            reconciledAt: row.reconciled_at,
            notes: row.notes,
        };
    }

    /**
     * Map database row to Account interface
     */
    private mapToAccount(row: Record<string, unknown>): Account {
        return {
            id: row.id as string,
            userId: row.user_id as string,
            type: row.type as string,
            bankId: row.bank_id as string | undefined,
            name: row.name as string,
            identifier: row.identifier as string | undefined,
            last4: row.last4 as string | undefined,
            balance: parseFloat(row.balance as string) || 0,
            availableBalance: row.available_balance
                ? parseFloat(row.available_balance as string)
                : undefined,
            currency: (row.currency as string) || 'INR',
            status: row.status as string,
            isPrimary: row.is_primary as boolean,
            interestRate: row.interest_rate
                ? parseFloat(row.interest_rate as string)
                : undefined,
            openingBalance: row.opening_balance
                ? parseFloat(row.opening_balance as string)
                : undefined,
            providerName: row.provider_name as string | undefined,
            isFrozen: row.is_frozen as boolean || false,
            closedAt: row.closed_at as Date | undefined,
            metadata: row.metadata as Record<string, unknown> | undefined,
            createdAt: row.created_at as Date,
            updatedAt: row.updated_at as Date,
        };
    }
}
