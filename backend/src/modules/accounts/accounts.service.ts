import { AccountsRepository, AccountRow, BalanceHistoryRow } from './accounts.repository';

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
        const rows = await AccountsRepository.findAll(userId, filters);
        return rows.map(this.mapToAccount);
    }

    /**
     * Get account by ID
     */
    async getById(userId: string, accountId: string): Promise<Account | null> {
        const row = await AccountsRepository.findById(userId, accountId);
        if (!row) return null;
        return this.mapToAccount(row);
    }

    /**
     * Create a new account
     */
    async create(userId: string, input: AccountInput): Promise<Account> {
        const row = await AccountsRepository.create({
            userId,
            type: input.type,
            name: input.name,
            bankId: input.bankId,
            identifier: input.identifier,
            last4: input.last4,
            balance: input.balance || 0,
            availableBalance: input.availableBalance || input.balance || 0,
            currency: input.currency || 'INR',
            interestRate: input.interestRate,
            openingBalance: input.openingBalance || input.balance || 0,
            providerName: input.providerName,
            metadata: input.metadata || {},
        });

        // Create initial balance history entry
        const today = new Date().toISOString().split('T')[0];
        await AccountsRepository.upsertBalanceSnapshot(row.id, userId, today, input.balance || 0);

        return this.mapToAccount(row);
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

        const row = await AccountsRepository.update(accountId, userId, {
            name: input.name,
            bankId: input.bankId,
            identifier: input.identifier,
            last4: input.last4,
            currency: input.currency,
            interestRate: input.interestRate,
            providerName: input.providerName,
            metadata: input.metadata,
        });

        return row ? this.mapToAccount(row) : null;
    }

    /**
     * Soft delete an account
     */
    async delete(userId: string, accountId: string): Promise<void> {
        await AccountsRepository.softDelete(accountId, userId);
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
        const row = await AccountsRepository.updateBalance(accountId, userId, newBalance);

        if (!row) {
            throw new Error('Account not found');
        }

        // Create balance history entry
        const today = new Date().toISOString().split('T')[0];
        const snapshotRow = await AccountsRepository.upsertBalanceSnapshot(
            accountId, userId, today, newBalance, notes
        );

        return {
            account: this.mapToAccount(row),
            snapshot: this.mapToBalanceHistory(snapshotRow),
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
        const rows = await AccountsRepository.getBalanceHistory(accountId, userId, options);
        return rows.map(this.mapToBalanceHistory);
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
        const row = await AccountsRepository.reconcile(accountId, userId, snapshotDate, notes);
        return this.mapToBalanceHistory(row);
    }

    /**
     * Get accounts summary with totals by type
     */
    async getSummary(userId: string): Promise<AccountsSummary> {
        const summaryRows = await AccountsRepository.getSummary(userId);

        const byType: Record<string, { count: number; totalBalance: number }> = {};
        let totalAccounts = 0;
        let totalBalance = 0;
        let totalLiabilities = 0;

        const liabilityTypes = ['credit_card'];

        for (const row of summaryRows) {
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
        const loansOutstanding = await AccountsRepository.getLoansOutstanding(userId);
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
        const row = await AccountsRepository.toggleFreeze(accountId, userId, freeze);

        if (!row) {
            throw new Error('Account not found');
        }

        return this.mapToAccount(row);
    }

    /**
     * Map database row to Account interface
     */
    private mapToAccount(row: AccountRow): Account {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            bankId: row.bank_id ?? undefined,
            name: row.name,
            identifier: row.identifier ?? undefined,
            last4: row.last4 ?? undefined,
            balance: parseFloat(String(row.balance)) || 0,
            availableBalance: row.available_balance
                ? parseFloat(String(row.available_balance))
                : undefined,
            currency: row.currency || 'INR',
            status: row.status,
            isPrimary: row.is_primary || false,
            interestRate: row.interest_rate
                ? parseFloat(String(row.interest_rate))
                : undefined,
            openingBalance: row.opening_balance
                ? parseFloat(String(row.opening_balance))
                : undefined,
            providerName: row.provider_name ?? undefined,
            isFrozen: row.is_frozen || false,
            closedAt: row.closed_at ?? undefined,
            metadata: row.metadata ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    private mapToBalanceHistory(row: BalanceHistoryRow): BalanceHistoryEntry {
        return {
            id: row.id,
            snapshotDate: row.snapshot_date,
            balance: parseFloat(String(row.balance)),
            availableBalance: row.available_balance
                ? parseFloat(String(row.available_balance))
                : undefined,
            isReconciled: row.is_reconciled,
            reconciledAt: row.reconciled_at ?? undefined,
            notes: row.notes ?? undefined,
        };
    }
}
