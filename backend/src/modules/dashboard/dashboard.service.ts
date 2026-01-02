import { DashboardRepository } from '@modules/dashboard/dashboard.repository';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface DashboardSummary {
    netWorth: number;
    accountTotals: {
        bankAccounts: number;
        wallets: number;
        cash: number;
        creditCardOutstanding: number;
        loansOutstanding: number;
    };
    monthlySnapshot: {
        income: number;
        expenses: number;
        savings: number;
        savingsRate: number;
    };
    accountCounts: {
        total: number;
        active: number;
        creditCards: number;
        bankAccounts: number;
        wallets: number;
    };
}

export interface DashboardAlert {
    id: string;
    type: 'bill_due' | 'low_balance' | 'high_credit_utilization' | 'emi_due' | 'goal_reminder' | 'budget_warning';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    dueDate?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
}

export interface CashflowData {
    month: string;
    income: number;
    expenses: number;
    net: number;
}

export interface RecentTransaction {
    id: string;
    date: string;
    merchant: string;
    category: string;
    amount: number;
    direction: 'credit' | 'debit';
    instrumentType: string;
    instrumentName: string;
}

export interface BudgetUsageItem {
    categoryName: string;
    budgetLimit: number;
    spent: number;
    remaining: number;
    usagePercent: number;
    status: 'safe' | 'warning' | 'exceeded';
}

export interface GoalProgress {
    id: string;
    name: string;
    type: string;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
    targetDate?: string;
    status: string;
    color?: string;
    icon?: string;
}

export interface SpendingInsight {
    type: 'top_category' | 'top_merchant' | 'trend' | 'anomaly';
    title: string;
    description: string;
    value?: number;
    change?: number;
    changeType?: 'increase' | 'decrease' | 'stable';
}

export class DashboardService {
    /**
     * Get comprehensive dashboard summary
     */
    async getSummary(userId: string): Promise<DashboardSummary> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Get account totals by type
        const accountRows = await DashboardRepository.getAccountBalancesByType(userId);

        // Calculate totals
        let bankAccounts = 0;
        let wallets = 0;
        let cash = 0;
        let creditCardOutstanding = 0;
        let totalAccounts = 0;
        let creditCards = 0;
        let bankAccountCount = 0;
        let walletCount = 0;

        for (const row of accountRows) {
            const balance = parseFloat(row.total) || 0;
            const count = parseInt(row.count) || 0;
            totalAccounts += count;

            switch (row.type) {
                case 'bank_account':
                case 'savings_account':
                case 'current_account':
                case 'nre_account':
                case 'nro_account':
                    bankAccounts += balance;
                    bankAccountCount += count;
                    break;
                case 'wallet':
                    wallets += balance;
                    walletCount += count;
                    break;
                case 'cash':
                    cash += balance;
                    break;
                case 'credit_card':
                    creditCardOutstanding += Math.abs(balance);
                    creditCards += count;
                    break;
            }
        }

        // Get loans outstanding
        const loansOutstanding = await DashboardRepository.getLoansOutstanding(userId);

        // Calculate net worth
        const netWorth = (bankAccounts + wallets + cash) - (creditCardOutstanding + loansOutstanding);

        // Get monthly spending summary
        const monthlyData = await DashboardRepository.getMonthlySpending(userId, month, year);

        // Calculate income (need separate query for credits)
        const incomeData = await DashboardRepository.getMonthlySpending(userId, month, year);
        const expenses = monthlyData.total;
        const income = 0; // Simplified - would need separate income query

        const savings = income - expenses;
        const savingsRate = income > 0 ? (savings / income) * 100 : 0;

        return {
            netWorth,
            accountTotals: {
                bankAccounts,
                wallets,
                cash,
                creditCardOutstanding,
                loansOutstanding,
            },
            monthlySnapshot: {
                income,
                expenses,
                savings,
                savingsRate: Math.round(savingsRate * 10) / 10,
            },
            accountCounts: {
                total: totalAccounts,
                active: totalAccounts,
                creditCards,
                bankAccounts: bankAccountCount,
                wallets: walletCount,
            },
        };
    }

    /**
     * Get alerts for dashboard panel
     */
    async getAlerts(userId: string): Promise<DashboardAlert[]> {
        const alerts: DashboardAlert[] = [];

        // Get overdue bills
        const overdueBills = await DashboardRepository.getOverdueBills(userId);
        for (const bill of overdueBills) {
            alerts.push({
                id: `bill_overdue_${bill.id}`,
                type: 'bill_due',
                priority: 'high',
                title: `Overdue: ${bill.name}`,
                message: `Bill of ₹${bill.amount?.toLocaleString() || 'N/A'} was due`,
                dueDate: bill.due_date,
                amount: parseFloat(bill.amount) || 0,
            });
        }

        // Get upcoming bills
        const upcomingBills = await DashboardRepository.getUpcomingBills(userId, 7);
        for (const bill of upcomingBills) {
            alerts.push({
                id: `bill_${bill.id}`,
                type: 'bill_due',
                priority: 'medium',
                title: `${bill.name} payment due`,
                message: `Bill of ₹${bill.amount?.toLocaleString() || 'N/A'}`,
                dueDate: bill.due_date,
                amount: parseFloat(bill.amount) || 0,
            });
        }

        // Get upcoming EMIs
        const upcomingEMIs = await DashboardRepository.getUpcomingEMIs(userId, 7);
        for (const emi of upcomingEMIs) {
            alerts.push({
                id: `emi_${emi.id}`,
                type: 'emi_due',
                priority: 'high',
                title: `${emi.loan_name} EMI due`,
                message: `EMI of ₹${emi.emi_amount?.toLocaleString() || 'N/A'}`,
                dueDate: emi.next_emi_date,
                amount: parseFloat(emi.emi_amount) || 0,
            });
        }

        // Get low balance accounts
        const lowBalanceAccounts = await DashboardRepository.getLowBalanceAccounts(userId, 5000);
        for (const account of lowBalanceAccounts) {
            alerts.push({
                id: `low_balance_${account.id}`,
                type: 'low_balance',
                priority: parseFloat(account.balance) < 1000 ? 'high' : 'medium',
                title: `Low balance in ${account.name}`,
                message: `Current balance: ₹${account.balance?.toLocaleString() || '0'}`,
                amount: parseFloat(account.balance) || 0,
            });
        }

        // Get high credit utilization cards
        const highUtilCards = await DashboardRepository.getHighCreditUtilization(userId, 0.7);
        for (const card of highUtilCards) {
            const utilization = Math.round(parseFloat(card.utilization) * 100);
            alerts.push({
                id: `credit_util_${card.id}`,
                type: 'high_credit_utilization',
                priority: utilization > 90 ? 'high' : 'medium',
                title: `High utilization on ${card.name}`,
                message: `${utilization}% of credit limit used`,
                amount: parseFloat(card.credit_used) || 0,
                metadata: { utilization, creditLimit: parseFloat(card.credit_limit) || 0 },
            });
        }

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return alerts;
    }

    /**
     * Get cashflow data for charts
     */
    async getCashflow(userId: string, months: number = 6): Promise<CashflowData[]> {
        const today = new Date();
        const startDate = format(startOfMonth(subMonths(today, months - 1)), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

        const rows = await DashboardRepository.getCashflowByMonth(userId, startDate, endDate);

        return rows.map(row => ({
            month: row.month,
            income: parseFloat(row.income) || 0,
            expenses: parseFloat(row.expenses) || 0,
            net: (parseFloat(row.income) || 0) - (parseFloat(row.expenses) || 0),
        }));
    }

    /**
     * Get recent transactions for dashboard feed
     */
    async getRecentTransactions(userId: string, limit: number = 10): Promise<RecentTransaction[]> {
        const rows = await DashboardRepository.getRecentTransactions(userId, limit);

        return rows.map(row => ({
            id: row.id,
            date: row.transaction_date,
            merchant: row.merchant_normalized || 'Unknown',
            category: row.category || 'Uncategorized',
            amount: parseFloat(row.amount) || 0,
            direction: row.direction,
            instrumentType: row.instrument_type || 'unknown',
            instrumentName: row.instrument_name || 'Unknown Account',
        }));
    }

    /**
     * Get budget usage summary
     */
    async getBudgetUsage(userId: string): Promise<BudgetUsageItem[]> {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        const rows = await DashboardRepository.getBudgetUsage(userId, month, year);

        return rows.map(row => {
            const budgetLimit = parseFloat(row.budget_limit) || 0;
            const spent = parseFloat(row.spent) || 0;
            const usagePercent = budgetLimit > 0 ? (spent / budgetLimit) * 100 : 0;

            return {
                categoryName: row.category_name,
                budgetLimit,
                spent,
                remaining: Math.max(0, budgetLimit - spent),
                usagePercent: Math.round(usagePercent),
                status: usagePercent >= 100 ? 'exceeded' : usagePercent >= 80 ? 'warning' : 'safe',
            };
        });
    }

    /**
     * Get goals progress overview
     */
    async getGoalsProgress(userId: string): Promise<GoalProgress[]> {
        const rows = await DashboardRepository.getGoalsProgress(userId, 5);

        return rows.map(row => ({
            id: row.id,
            name: row.goal_name,
            type: row.goal_type,
            targetAmount: parseFloat(row.target_amount) || 0,
            currentAmount: parseFloat(row.current_amount) || 0,
            progressPercent: parseFloat(row.progress_percent) || 0,
            targetDate: row.target_date,
            status: row.status,
            color: row.color,
            icon: row.icon,
        }));
    }

    /**
     * Get spending insights
     */
    async getSpendingInsights(userId: string): Promise<SpendingInsight[]> {
        const insights: SpendingInsight[] = [];
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        // Top spending categories
        const topCategories = await DashboardRepository.getTopSpendingCategories(userId, month, year, 1);
        if (topCategories.length > 0) {
            const row = topCategories[0];
            insights.push({
                type: 'top_category',
                title: 'Top Spending Category',
                description: `${row.category || 'Uncategorized'} is your biggest expense this month`,
                value: parseFloat(row.total) || 0,
            });
        }

        // Month-over-month spending trend
        const comparison = await DashboardRepository.getSpendingComparison(userId, month, year);
        if (comparison.previous > 0) {
            const change = ((comparison.current - comparison.previous) / comparison.previous) * 100;
            insights.push({
                type: 'trend',
                title: 'Spending Trend',
                description: change > 0
                    ? `Spending up ${Math.abs(Math.round(change))}% from last month`
                    : change < 0
                        ? `Spending down ${Math.abs(Math.round(change))}% from last month`
                        : 'Spending is stable compared to last month',
                value: comparison.current,
                change: Math.round(change),
                changeType: change > 5 ? 'increase' : change < -5 ? 'decrease' : 'stable',
            });
        }

        return insights;
    }
}
