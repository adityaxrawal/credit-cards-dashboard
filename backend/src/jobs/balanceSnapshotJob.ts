import pool from '../lib/db';
import dayjs from 'dayjs';

/**
 * Balance Snapshot Scheduler
 * Runs daily (typically at midnight) to capture balance snapshots for all accounts
 * This enables balance history charts and net worth tracking over time
 */
export async function runBalanceSnapshotJob() {
    console.log('[BalanceSnapshotJob] Starting...');

    try {
        // Get all active users
        const { rows: users } = await pool.query(
            'SELECT id FROM users WHERE is_active = true'
        );

        console.log(`[BalanceSnapshotJob] Processing ${users.length} users`);

        const snapshotDate = dayjs().format('YYYY-MM-DD');
        let totalSnapshots = 0;

        for (const user of users) {
            try {
                // Get all active accounts for the user
                const { rows: accounts } = await pool.query(
                    `SELECT id, balance FROM instruments 
           WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL`,
                    [user.id]
                );

                for (const account of accounts) {
                    // Check if snapshot already exists for today
                    const { rows: existing } = await pool.query(
                        `SELECT id FROM accounts_balance_history 
             WHERE account_id = $1 AND snapshot_date = $2`,
                        [account.id, snapshotDate]
                    );

                    if (existing.length === 0) {
                        // Create new snapshot
                        await pool.query(
                            `INSERT INTO accounts_balance_history 
               (account_id, balance, snapshot_date, snapshot_type)
               VALUES ($1, $2, $3, 'daily')`,
                            [account.id, account.balance, snapshotDate]
                        );
                        totalSnapshots++;
                    } else {
                        // Update existing snapshot with latest balance
                        await pool.query(
                            `UPDATE accounts_balance_history 
               SET balance = $2 WHERE id = $1`,
                            [existing[0].id, account.balance]
                        );
                    }
                }

                // Also capture net worth snapshot
                const { rows: netWorthResult } = await pool.query(
                    `SELECT 
            COALESCE(SUM(CASE WHEN type NOT IN ('credit_card') THEN balance ELSE 0 END), 0) as assets,
            COALESCE(SUM(CASE WHEN type = 'credit_card' THEN ABS(balance) ELSE 0 END), 0) as liabilities
           FROM instruments 
           WHERE user_id = $1 AND is_active = true AND deleted_at IS NULL`,
                    [user.id]
                );

                const assets = parseFloat(netWorthResult[0].assets);
                const liabilities = parseFloat(netWorthResult[0].liabilities);
                const netWorth = assets - liabilities;

                // Store net worth in dashboard_snapshots
                await pool.query(
                    `INSERT INTO dashboard_snapshots 
           (user_id, snapshot_date, snapshot_type, data)
           VALUES ($1, $2, 'net_worth', $3)
           ON CONFLICT (user_id, snapshot_date, snapshot_type)
           DO UPDATE SET data = $3, created_at = NOW()`,
                    [
                        user.id,
                        snapshotDate,
                        JSON.stringify({ assets, liabilities, netWorth })
                    ]
                );

            } catch (error) {
                console.error(`[BalanceSnapshotJob] Error processing user ${user.id}:`, error);
            }
        }

        console.log(`[BalanceSnapshotJob] Created ${totalSnapshots} balance snapshots`);
        console.log('[BalanceSnapshotJob] Completed');
    } catch (error) {
        console.error('[BalanceSnapshotJob] Job failed:', error);
        throw error;
    }
}

/**
 * Monthly summary snapshot (run on 1st of each month)
 */
export async function runMonthlySummarySnapshot() {
    console.log('[MonthlySummarySnapshot] Starting...');

    try {
        const { rows: users } = await pool.query(
            'SELECT id FROM users WHERE is_active = true'
        );

        const lastMonth = dayjs().subtract(1, 'month');
        const monthStart = lastMonth.startOf('month').format('YYYY-MM-DD');
        const monthEnd = lastMonth.endOf('month').format('YYYY-MM-DD');
        const snapshotDate = lastMonth.format('YYYY-MM');

        for (const user of users) {
            try {
                // Calculate monthly income and expenses
                const { rows: summary } = await pool.query(
                    `SELECT 
            COALESCE(SUM(CASE WHEN direction = 'credit' AND category != 'Transfer' THEN amount ELSE 0 END), 0) as income,
            COALESCE(SUM(CASE WHEN direction = 'debit' AND category != 'Transfer' THEN amount ELSE 0 END), 0) as expenses,
            COUNT(DISTINCT id) as transaction_count
           FROM transactions 
           WHERE user_id = $1 
           AND transaction_date BETWEEN $2 AND $3
           AND is_transfer IS NOT TRUE`,
                    [user.id, monthStart, monthEnd]
                );

                // Get category breakdown
                const { rows: categories } = await pool.query(
                    `SELECT category, 
            SUM(amount) as total,
            COUNT(*) as count
           FROM transactions 
           WHERE user_id = $1 
           AND transaction_date BETWEEN $2 AND $3
           AND direction = 'debit'
           AND is_transfer IS NOT TRUE
           GROUP BY category
           ORDER BY total DESC`,
                    [user.id, monthStart, monthEnd]
                );

                await pool.query(
                    `INSERT INTO dashboard_snapshots 
           (user_id, snapshot_date, snapshot_type, data)
           VALUES ($1, $2, 'monthly_summary', $3)
           ON CONFLICT (user_id, snapshot_date, snapshot_type)
           DO UPDATE SET data = $3`,
                    [
                        user.id,
                        snapshotDate,
                        JSON.stringify({
                            income: parseFloat(summary[0].income),
                            expenses: parseFloat(summary[0].expenses),
                            savings: parseFloat(summary[0].income) - parseFloat(summary[0].expenses),
                            transactionCount: parseInt(summary[0].transaction_count),
                            categoryBreakdown: categories.map(c => ({
                                category: c.category,
                                total: parseFloat(c.total),
                                count: parseInt(c.count)
                            }))
                        })
                    ]
                );

            } catch (error) {
                console.error(`[MonthlySummarySnapshot] Error processing user ${user.id}:`, error);
            }
        }

        console.log('[MonthlySummarySnapshot] Completed');
    } catch (error) {
        console.error('[MonthlySummarySnapshot] Job failed:', error);
        throw error;
    }
}

// If run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const jobType = args[0] || 'daily';

    const job = jobType === 'monthly' ? runMonthlySummarySnapshot : runBalanceSnapshotJob;

    job()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
