import pool from '../lib/db';
import dayjs from 'dayjs';

/**
 * Analytics Cache Refresh Job
 * Pre-computes and caches analytics data for faster dashboard loads
 * Runs on schedule (typically hourly or daily)
 */
export async function runAnalyticsCacheRefreshJob() {
    console.log('[AnalyticsCacheRefresh] Starting...');

    try {
        const { rows: users } = await pool.query(
            'SELECT id FROM users WHERE is_active = true'
        );

        console.log(`[AnalyticsCacheRefresh] Processing ${users.length} users`);

        for (const user of users) {
            try {
                await refreshUserAnalyticsCache(user.id);
            } catch (error) {
                console.error(`[AnalyticsCacheRefresh] Error processing user ${user.id}:`, error);
            }
        }

        console.log('[AnalyticsCacheRefresh] Completed');
    } catch (error) {
        console.error('[AnalyticsCacheRefresh] Job failed:', error);
        throw error;
    }
}

async function refreshUserAnalyticsCache(userId: string) {
    const today = dayjs();
    const monthStart = today.startOf('month').format('YYYY-MM-DD');
    const monthEnd = today.endOf('month').format('YYYY-MM-DD');
    const prevMonthStart = today.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
    const prevMonthEnd = today.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');

    // 1. Current Month Summary
    const { rows: currentMonth } = await pool.query(
        `SELECT 
      COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0) as expenses,
      COUNT(*) as txn_count
     FROM transactions 
     WHERE user_id = $1 
     AND transaction_date BETWEEN $2 AND $3
     AND is_transfer IS NOT TRUE`,
        [userId, monthStart, monthEnd]
    );

    // 2. Previous Month Summary (for comparison)
    const { rows: prevMonth } = await pool.query(
        `SELECT 
      COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0) as expenses
     FROM transactions 
     WHERE user_id = $1 
     AND transaction_date BETWEEN $2 AND $3
     AND is_transfer IS NOT TRUE`,
        [userId, prevMonthStart, prevMonthEnd]
    );

    // 3. Category Breakdown (current month)
    const { rows: categories } = await pool.query(
        `SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count
     FROM transactions 
     WHERE user_id = $1 
     AND transaction_date BETWEEN $2 AND $3
     AND direction = 'debit'
     AND is_transfer IS NOT TRUE
     GROUP BY category
     ORDER BY total DESC
     LIMIT 10`,
        [userId, monthStart, monthEnd]
    );

    // 4. Daily Spending Trend (last 30 days)
    const { rows: dailyTrend } = await pool.query(
        `SELECT 
      transaction_date::date as date,
      SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as spent,
      SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as received
     FROM transactions 
     WHERE user_id = $1 
     AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'
     AND is_transfer IS NOT TRUE
     GROUP BY transaction_date::date
     ORDER BY date`,
        [userId]
    );

    // 5. Top Merchants
    const { rows: topMerchants } = await pool.query(
        `SELECT 
      COALESCE(merchant_name, 'Unknown') as merchant,
      SUM(amount) as total,
      COUNT(*) as count
     FROM transactions 
     WHERE user_id = $1 
     AND transaction_date BETWEEN $2 AND $3
     AND direction = 'debit'
     AND is_transfer IS NOT TRUE
     GROUP BY COALESCE(merchant_name, 'Unknown')
     ORDER BY total DESC
     LIMIT 10`,
        [userId, monthStart, monthEnd]
    );

    // 6. Account Balances
    const { rows: balances } = await pool.query(
        `SELECT 
      COALESCE(SUM(CASE WHEN type NOT IN ('credit_card') THEN balance ELSE 0 END), 0) as assets,
      COALESCE(SUM(CASE WHEN type = 'credit_card' THEN ABS(balance) ELSE 0 END), 0) as liabilities,
      COUNT(*) as account_count
     FROM instruments 
     WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL`,
        [userId]
    );

    // 7. Goal Progress
    const { rows: goals } = await pool.query(
        `SELECT 
      COUNT(*) as total_goals,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_goals,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_goals,
      COALESCE(SUM(current_amount), 0) as total_saved,
      COALESCE(SUM(target_amount), 0) as total_target
     FROM goals 
     WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId]
    );

    // 8. Loan Summary
    const { rows: loans } = await pool.query(
        `SELECT 
      COUNT(*) as total_loans,
      COALESCE(SUM(current_outstanding), 0) as total_outstanding,
      COALESCE(SUM(emi_amount), 0) as total_monthly_emi
     FROM loans 
     WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [userId]
    );

    // 9. Upcoming Bills
    const { rows: upcomingBills } = await pool.query(
        `SELECT 
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as total
     FROM bills 
     WHERE user_id = $1 
     AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
     AND is_paid = false`,
        [userId]
    );

    // Store aggregated cache
    const cacheData = {
        currentMonth: {
            income: parseFloat(currentMonth[0].income),
            expenses: parseFloat(currentMonth[0].expenses),
            savings: parseFloat(currentMonth[0].income) - parseFloat(currentMonth[0].expenses),
            txnCount: parseInt(currentMonth[0].txn_count),
        },
        previousMonth: {
            income: parseFloat(prevMonth[0].income),
            expenses: parseFloat(prevMonth[0].expenses),
        },
        categoryBreakdown: categories.map(c => ({
            category: c.category,
            total: parseFloat(c.total),
            count: parseInt(c.count),
        })),
        dailyTrend: dailyTrend.map(d => ({
            date: d.date,
            spent: parseFloat(d.spent),
            received: parseFloat(d.received),
        })),
        topMerchants: topMerchants.map(m => ({
            merchant: m.merchant,
            total: parseFloat(m.total),
            count: parseInt(m.count),
        })),
        balances: {
            assets: parseFloat(balances[0].assets),
            liabilities: parseFloat(balances[0].liabilities),
            netWorth: parseFloat(balances[0].assets) - parseFloat(balances[0].liabilities),
            accountCount: parseInt(balances[0].account_count),
        },
        goals: {
            total: parseInt(goals[0].total_goals),
            active: parseInt(goals[0].active_goals),
            completed: parseInt(goals[0].completed_goals),
            totalSaved: parseFloat(goals[0].total_saved),
            totalTarget: parseFloat(goals[0].total_target),
            progress: goals[0].total_target > 0
                ? Math.round((parseFloat(goals[0].total_saved) / parseFloat(goals[0].total_target)) * 100)
                : 0,
        },
        loans: {
            total: parseInt(loans[0].total_loans),
            outstanding: parseFloat(loans[0].total_outstanding),
            monthlyEmi: parseFloat(loans[0].total_monthly_emi),
        },
        upcomingBills: {
            count: parseInt(upcomingBills[0].count),
            total: parseFloat(upcomingBills[0].total),
        },
        cachedAt: new Date().toISOString(),
    };

    // Store in dashboard_snapshots
    await pool.query(
        `INSERT INTO dashboard_snapshots 
     (user_id, snapshot_date, snapshot_type, data)
     VALUES ($1, $2, 'analytics_cache', $3)
     ON CONFLICT (user_id, snapshot_date, snapshot_type)
     DO UPDATE SET data = $3, created_at = NOW()`,
        [userId, today.format('YYYY-MM-DD'), JSON.stringify(cacheData)]
    );

    console.log(`[AnalyticsCacheRefresh] Updated cache for user ${userId}`);
}

/**
 * Get cached analytics (for use in dashboard API)
 */
export async function getCachedAnalytics(userId: string): Promise<any | null> {
    const { rows } = await pool.query(
        `SELECT data FROM dashboard_snapshots 
     WHERE user_id = $1 
     AND snapshot_type = 'analytics_cache'
     AND snapshot_date = CURRENT_DATE`,
        [userId]
    );

    return rows.length > 0 ? rows[0].data : null;
}

/**
 * Invalidate cache (call when significant changes occur)
 */
export async function invalidateAnalyticsCache(userId: string): Promise<void> {
    await pool.query(
        `DELETE FROM dashboard_snapshots 
     WHERE user_id = $1 AND snapshot_type = 'analytics_cache'`,
        [userId]
    );
}

// If run directly
if (require.main === module) {
    runAnalyticsCacheRefreshJob()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
