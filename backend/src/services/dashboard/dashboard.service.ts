import pool from '../../lib/db';
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

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
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // Get account totals by type
        const accountsQuery = `
      SELECT 
        type,
        SUM(CASE WHEN type IN ('bank_account', 'savings_account', 'current_account', 'nre_account', 'nro_account') THEN COALESCE(balance, 0) ELSE 0 END) as bank_balance,
        SUM(CASE WHEN type IN ('wallet') THEN COALESCE(balance, 0) ELSE 0 END) as wallet_balance,
        SUM(CASE WHEN type = 'cash' THEN COALESCE(balance, 0) ELSE 0 END) as cash_balance,
        SUM(CASE WHEN type = 'credit_card' THEN ABS(COALESCE(balance, 0)) ELSE 0 END) as credit_outstanding,
        COUNT(*) as count
      FROM instruments
      WHERE user_id = $1 AND status = 'active'
      GROUP BY type
    `;
        const accountsResult = await pool.query(accountsQuery, [userId]);

        // Calculate totals
        let bankAccounts = 0;
        let wallets = 0;
        let cash = 0;
        let creditCardOutstanding = 0;
        let totalAccounts = 0;
        let creditCards = 0;
        let bankAccountCount = 0;
        let walletCount = 0;

        for (const row of accountsResult.rows) {
            bankAccounts += parseFloat(row.bank_balance) || 0;
            wallets += parseFloat(row.wallet_balance) || 0;
            cash += parseFloat(row.cash_balance) || 0;
            creditCardOutstanding += parseFloat(row.credit_outstanding) || 0;
            totalAccounts += parseInt(row.count) || 0;

            if (row.type === 'credit_card') creditCards += parseInt(row.count) || 0;
            if (['bank_account', 'savings_account', 'current_account'].includes(row.type)) {
                bankAccountCount += parseInt(row.count) || 0;
            }
            if (row.type === 'wallet') walletCount += parseInt(row.count) || 0;
        }

        // Get loans outstanding
        const loansQuery = `
      SELECT COALESCE(SUM(current_outstanding), 0) as total
      FROM loans
      WHERE user_id = $1 AND status = 'active'
    `;
        const loansResult = await pool.query(loansQuery, [userId]);
        const loansOutstanding = parseFloat(loansResult.rows[0]?.total) || 0;

        // Calculate net worth (assets - liabilities, excluding investments)
        const netWorth = (bankAccounts + wallets + cash) - (creditCardOutstanding + loansOutstanding);

        // Get monthly income and expenses
        const monthlyQuery = `
      SELECT 
        direction,
        SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND transaction_date >= $2 
        AND transaction_date <= $3
        AND is_transfer = false
      GROUP BY direction
    `;
        const monthlyResult = await pool.query(monthlyQuery, [userId, monthStart, monthEnd]);

        let income = 0;
        let expenses = 0;
        for (const row of monthlyResult.rows) {
            if (row.direction === 'credit') income = parseFloat(row.total) || 0;
            if (row.direction === 'debit') expenses = parseFloat(row.total) || 0;
        }

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
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Check for upcoming bills/recurring payments
        const billsQuery = `
      SELECT id, merchant, typical_amount, next_expected, category
      FROM recurring_patterns
      WHERE user_id = $1 
        AND status = 'active'
        AND next_expected >= $2 
        AND next_expected <= $3
      ORDER BY next_expected
      LIMIT 5
    `;
        const billsResult = await pool.query(billsQuery, [userId, today, nextWeek]);

        for (const bill of billsResult.rows) {
            alerts.push({
                id: `bill_${bill.id}`,
                type: 'bill_due',
                priority: 'medium',
                title: `${bill.merchant} payment due`,
                message: `Expected payment of ₹${bill.typical_amount?.toLocaleString() || 'N/A'}`,
                dueDate: bill.next_expected,
                amount: bill.typical_amount,
                metadata: { category: bill.category },
            });
        }

        // Check for upcoming EMIs
        const emisQuery = `
      SELECT id, loan_name, emi_amount, next_emi_date, lender_name
      FROM loans
      WHERE user_id = $1 
        AND status = 'active'
        AND next_emi_date >= $2 
        AND next_emi_date <= $3
      ORDER BY next_emi_date
      LIMIT 5
    `;
        const emisResult = await pool.query(emisQuery, [userId, today, nextWeek]);

        for (const emi of emisResult.rows) {
            alerts.push({
                id: `emi_${emi.id}`,
                type: 'emi_due',
                priority: 'high',
                title: `${emi.loan_name} EMI due`,
                message: `EMI of ₹${emi.emi_amount?.toLocaleString() || 'N/A'} to ${emi.lender_name || 'Lender'}`,
                dueDate: emi.next_emi_date,
                amount: emi.emi_amount,
            });
        }

        // Check for low balance accounts
        const lowBalanceQuery = `
      SELECT id, name, type, balance
      FROM instruments
      WHERE user_id = $1 
        AND status = 'active'
        AND type IN ('bank_account', 'savings_account', 'current_account')
        AND balance < 5000
      ORDER BY balance
      LIMIT 3
    `;
        const lowBalanceResult = await pool.query(lowBalanceQuery, [userId]);

        for (const account of lowBalanceResult.rows) {
            alerts.push({
                id: `low_balance_${account.id}`,
                type: 'low_balance',
                priority: account.balance < 1000 ? 'high' : 'medium',
                title: `Low balance in ${account.name}`,
                message: `Current balance: ₹${account.balance?.toLocaleString() || '0'}`,
                amount: account.balance,
            });
        }

        // Check for high credit utilization
        const creditUtilQuery = `
      SELECT 
        id, 
        name,
        ABS(balance) as outstanding,
        (metadata->>'credit_limit')::numeric as credit_limit
      FROM instruments
      WHERE user_id = $1 
        AND type = 'credit_card'
        AND status = 'active'
        AND (metadata->>'credit_limit')::numeric > 0
    `;
        const creditUtilResult = await pool.query(creditUtilQuery, [userId]);

        for (const card of creditUtilResult.rows) {
            const utilization = card.credit_limit > 0
                ? (card.outstanding / card.credit_limit) * 100
                : 0;

            if (utilization > 70) {
                alerts.push({
                    id: `credit_util_${card.id}`,
                    type: 'high_credit_utilization',
                    priority: utilization > 90 ? 'high' : 'medium',
                    title: `High utilization on ${card.name}`,
                    message: `${Math.round(utilization)}% of credit limit used`,
                    amount: card.outstanding,
                    metadata: { utilization, creditLimit: card.credit_limit },
                });
            }
        }

        // Check for budget warnings
        const budgetQuery = `
      SELECT 
        bt.id,
        bt.budget_limit,
        bt.total_spent,
        ((bt.total_spent / bt.budget_limit) * 100) as usage_percent
      FROM budget_tracking bt
      WHERE bt.user_id = $1 
        AND bt.month = $2 
        AND bt.year = $3
        AND bt.total_spent >= bt.budget_limit * 0.8
    `;
        const budgetResult = await pool.query(budgetQuery, [
            userId,
            today.getMonth() + 1,
            today.getFullYear()
        ]);

        for (const budget of budgetResult.rows) {
            const usagePercent = Math.round(budget.usage_percent);
            alerts.push({
                id: `budget_${budget.id}`,
                type: 'budget_warning',
                priority: usagePercent >= 100 ? 'high' : 'medium',
                title: usagePercent >= 100 ? 'Budget exceeded' : 'Budget warning',
                message: `${usagePercent}% of monthly budget used`,
                amount: budget.total_spent,
                metadata: { budgetLimit: budget.budget_limit, usagePercent },
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
        const cashflowData: CashflowData[] = [];
        const today = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const monthDate = subMonths(today, i);
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);

            const query = `
        SELECT 
          direction,
          SUM(amount) as total
        FROM transactions
        WHERE user_id = $1 
          AND transaction_date >= $2 
          AND transaction_date <= $3
          AND is_transfer = false
        GROUP BY direction
      `;
            const result = await pool.query(query, [userId, monthStart, monthEnd]);

            let income = 0;
            let expenses = 0;
            for (const row of result.rows) {
                if (row.direction === 'credit') income = parseFloat(row.total) || 0;
                if (row.direction === 'debit') expenses = parseFloat(row.total) || 0;
            }

            cashflowData.push({
                month: format(monthDate, 'MMM yyyy'),
                income,
                expenses,
                net: income - expenses,
            });
        }

        return cashflowData;
    }

    /**
     * Get recent transactions for dashboard feed
     */
    async getRecentTransactions(userId: string, limit: number = 10): Promise<RecentTransaction[]> {
        const query = `
      SELECT 
        t.id,
        t.transaction_date,
        t.merchant,
        t.category,
        t.amount,
        t.direction,
        t.instrument_type,
        i.name as instrument_name
      FROM transactions t
      LEFT JOIN instruments i ON t.instrument_id = i.id
      WHERE t.user_id = $1
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT $2
    `;
        const result = await pool.query(query, [userId, limit]);

        return result.rows.map(row => ({
            id: row.id,
            date: row.transaction_date,
            merchant: row.merchant || 'Unknown',
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

        // Get overall budget
        const overallQuery = `
      SELECT 
        bt.budget_limit,
        bt.total_spent
      FROM budget_tracking bt
      WHERE bt.user_id = $1 
        AND bt.month = $2 
        AND bt.year = $3
    `;
        const overallResult = await pool.query(overallQuery, [
            userId,
            today.getMonth() + 1,
            today.getFullYear()
        ]);

        const usageItems: BudgetUsageItem[] = [];

        if (overallResult.rows.length > 0) {
            const budget = overallResult.rows[0];
            const usagePercent = budget.budget_limit > 0
                ? (budget.total_spent / budget.budget_limit) * 100
                : 0;

            usageItems.push({
                categoryName: 'Overall Budget',
                budgetLimit: parseFloat(budget.budget_limit) || 0,
                spent: parseFloat(budget.total_spent) || 0,
                remaining: Math.max(0, (parseFloat(budget.budget_limit) || 0) - (parseFloat(budget.total_spent) || 0)),
                usagePercent: Math.round(usagePercent),
                status: usagePercent >= 100 ? 'exceeded' : usagePercent >= 80 ? 'warning' : 'safe',
            });
        }

        // Get category budgets
        const categoryQuery = `
      SELECT 
        category_name,
        monthly_limit,
        current_spent
      FROM category_budgets
      WHERE user_id = $1
      ORDER BY current_spent DESC
      LIMIT 5
    `;
        const categoryResult = await pool.query(categoryQuery, [userId]);

        for (const row of categoryResult.rows) {
            const usagePercent = row.monthly_limit > 0
                ? (row.current_spent / row.monthly_limit) * 100
                : 0;

            usageItems.push({
                categoryName: row.category_name,
                budgetLimit: parseFloat(row.monthly_limit) || 0,
                spent: parseFloat(row.current_spent) || 0,
                remaining: Math.max(0, (parseFloat(row.monthly_limit) || 0) - (parseFloat(row.current_spent) || 0)),
                usagePercent: Math.round(usagePercent),
                status: usagePercent >= 100 ? 'exceeded' : usagePercent >= 80 ? 'warning' : 'safe',
            });
        }

        return usageItems;
    }

    /**
     * Get goals progress overview
     */
    async getGoalsProgress(userId: string): Promise<GoalProgress[]> {
        const query = `
      SELECT 
        id,
        goal_name,
        goal_type,
        target_amount,
        current_amount,
        progress_percent,
        target_date,
        status,
        color,
        icon
      FROM goals
      WHERE user_id = $1 AND status IN ('active', 'completed')
      ORDER BY 
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        progress_percent DESC
      LIMIT 5
    `;
        const result = await pool.query(query, [userId]);

        return result.rows.map(row => ({
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
        const thisMonth = startOfMonth(today);
        const lastMonth = startOfMonth(subMonths(today, 1));
        const lastMonthEnd = endOfMonth(subMonths(today, 1));

        // Top spending category this month
        const topCategoryQuery = `
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND direction = 'debit'
        AND transaction_date >= $2
        AND is_transfer = false
      GROUP BY category
      ORDER BY total DESC
      LIMIT 1
    `;
        const topCategoryResult = await pool.query(topCategoryQuery, [userId, thisMonth]);

        if (topCategoryResult.rows.length > 0) {
            const row = topCategoryResult.rows[0];
            insights.push({
                type: 'top_category',
                title: 'Top Spending Category',
                description: `${row.category || 'Uncategorized'} is your biggest expense this month`,
                value: parseFloat(row.total) || 0,
            });
        }

        // Top merchant this month
        const topMerchantQuery = `
      SELECT merchant, COUNT(*) as count, SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND direction = 'debit'
        AND transaction_date >= $2
        AND is_transfer = false
        AND merchant IS NOT NULL
      GROUP BY merchant
      ORDER BY total DESC
      LIMIT 1
    `;
        const topMerchantResult = await pool.query(topMerchantQuery, [userId, thisMonth]);

        if (topMerchantResult.rows.length > 0) {
            const row = topMerchantResult.rows[0];
            insights.push({
                type: 'top_merchant',
                title: 'Most Visited Merchant',
                description: `${row.merchant} (${row.count} transactions)`,
                value: parseFloat(row.total) || 0,
            });
        }

        // Month-over-month spending trend
        const thisMonthQuery = `
      SELECT SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND direction = 'debit'
        AND transaction_date >= $2
        AND is_transfer = false
    `;
        const thisMonthSpending = await pool.query(thisMonthQuery, [userId, thisMonth]);

        const lastMonthQuery = `
      SELECT SUM(amount) as total
      FROM transactions
      WHERE user_id = $1 
        AND direction = 'debit'
        AND transaction_date >= $2
        AND transaction_date <= $3
        AND is_transfer = false
    `;
        const lastMonthSpending = await pool.query(lastMonthQuery, [userId, lastMonth, lastMonthEnd]);

        const thisMonthTotal = parseFloat(thisMonthSpending.rows[0]?.total) || 0;
        const lastMonthTotal = parseFloat(lastMonthSpending.rows[0]?.total) || 0;

        if (lastMonthTotal > 0) {
            const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
            insights.push({
                type: 'trend',
                title: 'Spending Trend',
                description: change > 0
                    ? `Spending up ${Math.abs(Math.round(change))}% from last month`
                    : change < 0
                        ? `Spending down ${Math.abs(Math.round(change))}% from last month`
                        : 'Spending is stable compared to last month',
                value: thisMonthTotal,
                change: Math.round(change),
                changeType: change > 5 ? 'increase' : change < -5 ? 'decrease' : 'stable',
            });
        }

        return insights;
    }
}
