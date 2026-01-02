import { SharedExpenseRepository } from '../../repositories/SharedExpenseRepository';

export interface SharedExpenseInput {
    title: string;
    description?: string;
    totalAmount: number;
    currency?: string;
    expenseDate?: string;
    paidByUserId?: string;
    splits: {
        userId?: string;
        memberName: string;
        shareAmount?: number;
        sharePercent?: number;
    }[];
}

export interface SharedExpense {
    id: string;
    userId: string;
    groupName?: string;
    title: string;
    description?: string;
    totalAmount: number;
    currency: string;
    expenseDate: string;
    paidByUserId?: string;
    status: string;
    splits: ExpenseSplit[];
    createdAt: Date;
}

export interface ExpenseSplit {
    id: string;
    sharedExpenseId: string;
    userId?: string;
    memberName: string;
    shareAmount: number;
    sharePercent: number;
    isPaid: boolean;
    paidAt?: Date;
}

export class SharedExpenseService {
    /**
     * Create shared expense with splits
     */
    async create(userId: string, input: SharedExpenseInput): Promise<SharedExpense> {
        // Calculate shares if not provided
        const splitCount = input.splits.length;
        const calculatedSplits = input.splits.map(split => ({
            userId: split.userId,
            memberName: split.memberName,
            shareAmount: split.shareAmount || input.totalAmount / splitCount,
            sharePercent: split.sharePercent || 100 / splitCount,
        }));

        // Create expense
        const expense = await SharedExpenseRepository.create({
            userId,
            title: input.title,
            description: input.description,
            totalAmount: input.totalAmount,
            currency: input.currency || 'INR',
            expenseDate: input.expenseDate || new Date().toISOString().split('T')[0],
            paidByUserId: input.paidByUserId,
        });

        // Create splits
        const splits: ExpenseSplit[] = [];
        for (const split of calculatedSplits) {
            const splitRow = await SharedExpenseRepository.createSplit(expense.id, split);
            splits.push(this.mapSplitRow(splitRow));
        }

        return {
            ...this.mapExpenseRow(expense),
            splits,
        };
    }

    /**
     * Get all shared expenses for user
     */
    async getAll(userId: string, filters?: { status?: string }): Promise<SharedExpense[]> {
        const expenses = await SharedExpenseRepository.findAll(userId, filters?.status);

        const result: SharedExpense[] = [];
        for (const expense of expenses) {
            const splits = await SharedExpenseRepository.getSplits(expense.id);
            result.push({
                ...this.mapExpenseRow(expense),
                splits: splits.map(this.mapSplitRow),
            });
        }

        return result;
    }

    /**
     * Get expense by ID
     */
    async getById(userId: string, id: string): Promise<SharedExpense | null> {
        const expense = await SharedExpenseRepository.findById(id, userId);
        if (!expense) return null;

        const splits = await SharedExpenseRepository.getSplits(id);
        return {
            ...this.mapExpenseRow(expense),
            splits: splits.map(this.mapSplitRow),
        };
    }

    /**
     * Mark split as paid
     */
    async markSplitPaid(userId: string, splitId: string): Promise<ExpenseSplit> {
        const row = await SharedExpenseRepository.markSplitPaid(splitId);

        // Update expense status
        await SharedExpenseRepository.updateStatus(row.shared_expense_id);

        return this.mapSplitRow(row);
    }

    /**
     * Get settlement summary - who owes whom
     */
    async getSettlementSummary(userId: string): Promise<any[]> {
        return SharedExpenseRepository.getSettlementSummary(userId);
    }

    /**
     * Delete shared expense
     */
    async delete(userId: string, id: string): Promise<void> {
        await SharedExpenseRepository.delete(id, userId);
    }

    private mapExpenseRow(row: any): Omit<SharedExpense, 'splits'> {
        return {
            id: row.id,
            userId: row.user_id,
            groupName: row.group_name,
            title: row.title,
            description: row.description,
            totalAmount: parseFloat(row.total_amount) || 0,
            currency: row.currency || 'INR',
            expenseDate: row.expense_date,
            paidByUserId: row.paid_by_user_id,
            status: row.status,
            createdAt: row.created_at,
        };
    }

    private mapSplitRow(row: any): ExpenseSplit {
        return {
            id: row.id,
            sharedExpenseId: row.shared_expense_id,
            userId: row.user_id,
            memberName: row.member_name,
            shareAmount: parseFloat(row.share_amount) || 0,
            sharePercent: parseFloat(row.share_percent) || 0,
            isPaid: row.is_paid || false,
            paidAt: row.paid_at,
        };
    }
}
