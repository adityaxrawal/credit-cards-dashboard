import { runBalanceSnapshotJob, runMonthlySummarySnapshot } from './balanceSnapshotJob';
import { runEmiReminderJob, updateEmiDatesJob } from './emiReminderJob';
import { runBillAutoDetectionJob, updateBillAmountsJob } from './billAutoDetectionJob';
import { runRecurringPatternDetectorJob, markMissedRecurringJob } from './recurringPatternDetectorJob';
import { runAnalyticsCacheRefreshJob } from './analyticsCacheRefreshJob';
import { runBillReminderJob } from './billReminderJob';
import { runSpendingAlertJob } from './spendingAlertJob';

/**
 * Job Scheduler
 * Orchestrates all background jobs with proper scheduling
 */

export type JobName =
    | 'balance_snapshot'
    | 'monthly_summary'
    | 'emi_reminder'
    | 'update_emi_dates'
    | 'bill_auto_detection'
    | 'update_bill_amounts'
    | 'recurring_pattern_detector'
    | 'mark_missed_recurring'
    | 'analytics_cache_refresh'
    | 'bill_reminder'
    | 'spending_alert'
    | 'all_daily'
    | 'all_hourly';

interface JobConfig {
    name: string;
    fn: () => Promise<void>;
    schedule: 'hourly' | 'daily' | 'weekly' | 'monthly';
    enabled: boolean;
}

const jobs: Record<JobName, JobConfig | (() => Promise<void>)> = {
    balance_snapshot: {
        name: 'Balance Snapshot',
        fn: runBalanceSnapshotJob,
        schedule: 'daily',
        enabled: true,
    },
    monthly_summary: {
        name: 'Monthly Summary Snapshot',
        fn: runMonthlySummarySnapshot,
        schedule: 'monthly',
        enabled: true,
    },
    emi_reminder: {
        name: 'EMI Reminder',
        fn: runEmiReminderJob,
        schedule: 'daily',
        enabled: true,
    },
    update_emi_dates: {
        name: 'Update EMI Dates',
        fn: updateEmiDatesJob,
        schedule: 'daily',
        enabled: true,
    },
    bill_auto_detection: {
        name: 'Bill Auto Detection',
        fn: runBillAutoDetectionJob,
        schedule: 'weekly',
        enabled: true,
    },
    update_bill_amounts: {
        name: 'Update Bill Amounts',
        fn: updateBillAmountsJob,
        schedule: 'weekly',
        enabled: true,
    },
    recurring_pattern_detector: {
        name: 'Recurring Pattern Detector',
        fn: runRecurringPatternDetectorJob,
        schedule: 'weekly',
        enabled: true,
    },
    mark_missed_recurring: {
        name: 'Mark Missed Recurring',
        fn: markMissedRecurringJob,
        schedule: 'daily',
        enabled: true,
    },
    analytics_cache_refresh: {
        name: 'Analytics Cache Refresh',
        fn: runAnalyticsCacheRefreshJob,
        schedule: 'hourly',
        enabled: true,
    },
    bill_reminder: {
        name: 'Bill Reminder',
        fn: runBillReminderJob,
        schedule: 'daily',
        enabled: true,
    },
    spending_alert: {
        name: 'Spending Alert',
        fn: runSpendingAlertJob,
        schedule: 'daily',
        enabled: true,
    },
    all_daily: async () => {
        await runDailyJobs();
    },
    all_hourly: async () => {
        await runHourlyJobs();
    },
};

/**
 * Run a specific job by name
 */
export async function runJob(jobName: JobName): Promise<{ success: boolean; error?: string; duration: number }> {
    const startTime = Date.now();

    try {
        const job = jobs[jobName];

        if (!job) {
            throw new Error(`Unknown job: ${jobName}`);
        }

        if (typeof job === 'function') {
            await job();
        } else {
            if (!job.enabled) {
                console.log(`[Scheduler] Job ${jobName} is disabled, skipping`);
                return { success: true, duration: Date.now() - startTime };
            }
            await job.fn();
        }

        const duration = Date.now() - startTime;
        console.log(`[Scheduler] Job ${jobName} completed in ${duration}ms`);

        return { success: true, duration };
    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`[Scheduler] Job ${jobName} failed after ${duration}ms:`, error);

        return { success: false, error: error.message, duration };
    }
}

/**
 * Run all daily jobs
 */
export async function runDailyJobs(): Promise<void> {
    console.log('[Scheduler] Running daily jobs...');

    const dailyJobs: JobName[] = [
        'balance_snapshot',
        'emi_reminder',
        'update_emi_dates',
        'mark_missed_recurring',
        'bill_reminder',
        'spending_alert',
    ];

    for (const jobName of dailyJobs) {
        await runJob(jobName);
    }

    console.log('[Scheduler] Daily jobs completed');
}

/**
 * Run all hourly jobs
 */
export async function runHourlyJobs(): Promise<void> {
    console.log('[Scheduler] Running hourly jobs...');

    const hourlyJobs: JobName[] = [
        'analytics_cache_refresh',
    ];

    for (const jobName of hourlyJobs) {
        await runJob(jobName);
    }

    console.log('[Scheduler] Hourly jobs completed');
}

/**
 * Run all weekly jobs
 */
export async function runWeeklyJobs(): Promise<void> {
    console.log('[Scheduler] Running weekly jobs...');

    const weeklyJobs: JobName[] = [
        'bill_auto_detection',
        'update_bill_amounts',
        'recurring_pattern_detector',
    ];

    for (const jobName of weeklyJobs) {
        await runJob(jobName);
    }

    console.log('[Scheduler] Weekly jobs completed');
}

/**
 * Run all monthly jobs
 */
export async function runMonthlyJobs(): Promise<void> {
    console.log('[Scheduler] Running monthly jobs...');

    const monthlyJobs: JobName[] = [
        'monthly_summary',
    ];

    for (const jobName of monthlyJobs) {
        await runJob(jobName);
    }

    console.log('[Scheduler] Monthly jobs completed');
}

/**
 * Get list of available jobs
 */
export function getAvailableJobs(): { name: JobName; config: Omit<JobConfig, 'fn'> }[] {
    return Object.entries(jobs)
        .filter(([_, value]) => typeof value !== 'function')
        .map(([name, config]) => ({
            name: name as JobName,
            config: {
                name: (config as JobConfig).name,
                schedule: (config as JobConfig).schedule,
                enabled: (config as JobConfig).enabled,
            },
        }));
}

// If run directly from command line
if (require.main === module) {
    const args = process.argv.slice(2);
    const jobName = (args[0] || 'all_daily') as JobName;

    console.log(`[Scheduler] Starting job: ${jobName}`);

    runJob(jobName)
        .then((result) => {
            if (result.success) {
                console.log(`[Scheduler] Job completed successfully in ${result.duration}ms`);
                process.exit(0);
            } else {
                console.error(`[Scheduler] Job failed: ${result.error}`);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('[Scheduler] Unexpected error:', error);
            process.exit(1);
        });
}
