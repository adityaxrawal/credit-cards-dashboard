import dayjs from 'dayjs';
import { UserRepository } from '../repositories/UserRepository';
import { InstrumentRepository } from '../repositories/InstrumentRepository';
import { BalanceHistoryRepository } from '../repositories/BalanceHistoryRepository';
import { DashboardRepository } from '../repositories/DashboardRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';

/**
 * Balance Snapshot Scheduler
 * Runs daily (typically at midnight) to capture balance snapshots for all accounts
 * This enables balance history charts and net worth tracking over time
 */
export async function runBalanceSnapshotJob() {
    console.log('[BalanceSnapshotJob] Starting...');

    try {
        // Get all active users
        const users = await UserRepository.getAllActiveUsers();

        console.log(`[BalanceSnapshotJob] Processing ${users.length} users`);

        const snapshotDate = dayjs().format('YYYY-MM-DD');
        let totalSnapshots = 0;

        for (const user of users) {
            try {
                // Get all active accounts for the user
                const accounts = await InstrumentRepository.findActiveByUserId(user.id);

                for (const account of accounts) {
                    await BalanceHistoryRepository.recordSnapshot(
                        user.id,
                        account.id,
                        snapshotDate,
                        account.balance || 0,
                        'daily'
                    );
                    totalSnapshots++;
                }

                // Also capture net worth snapshot
                const netWorthData = await InstrumentRepository.calculateNetWorth(user.id);

                // Store net worth in dashboard_snapshots
                await DashboardRepository.saveSnapshot(
                    user.id,
                    snapshotDate,
                    'net_worth',
                    netWorthData
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
        const users = await UserRepository.getAllActiveUsers();

        const lastMonth = dayjs().subtract(1, 'month');
        const monthStart = lastMonth.startOf('month').format('YYYY-MM-DD');
        const monthEnd = lastMonth.endOf('month').format('YYYY-MM-DD');
        const snapshotDate = lastMonth.format('YYYY-MM');

        for (const user of users) {
            try {
                // Calculate monthly income and expenses
                const summary = await TransactionRepository.getMonthlySummary(user.id, monthStart, monthEnd);

                // Get category breakdown
                const categories = await TransactionRepository.getCategoryBreakdown(user.id, monthStart, monthEnd);

                await DashboardRepository.saveSnapshot(
                    user.id,
                    snapshotDate,
                    'monthly_summary',
                    {
                        income: summary.income,
                        expenses: summary.expenses,
                        savings: summary.income - summary.expenses,
                        transactionCount: summary.transaction_count,
                        categoryBreakdown: categories.map(c => ({
                            category: c.category,
                            total: c.total,
                            count: c.count
                        }))
                    }
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
