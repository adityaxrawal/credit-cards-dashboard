
/**
 * Scheduler Service
 * Handles periodic tasks like generating reports, checking budget rollover, etc.
 */

import cron from 'node-cron';
import logger from '../../utils/infrastructure/logger';
import { ReportService } from './ReportService';
import { BudgetRulesService } from '../bills/BudgetRulesService';
import { UserRepository } from '../../repositories/user.repository';
import dayjs from 'dayjs';
// import { EmailService } from '../notifications/EmailService'; // Assuming exists or need to import

export class SchedulerService {
    private static instance: SchedulerService;
    private jobs: cron.ScheduledTask[] = [];

    private constructor() { }

    static getInstance(): SchedulerService {
        if (!SchedulerService.instance) {
            SchedulerService.instance = new SchedulerService();
        }
        return SchedulerService.instance;
    }

    /**
     * Initialize all scheduled jobs
     */
    init() {
        logger.info('[Scheduler] Initializing scheduled jobs...');

        // 1. Monthly Report Generation (1st of every month at 9 AM)
        this.jobs.push(cron.schedule('0 9 1 * *', () => {
            this.generateMonthlyReports();
        }));

        // 2. Budget Rollover Check (1st of every month at 1 AM)
        this.jobs.push(cron.schedule('0 1 1 * *', () => {
            this.executeRollover();
        }));

        // 3. Weekly Summary (Mondays at 8 AM)
        this.jobs.push(cron.schedule('0 8 * * 1', () => {
            this.generateWeeklySummary();
        }));

        logger.info(`[Scheduler] ${this.jobs.length} jobs scheduled.`);
    }

    /**
     * Generate monthly reports for all users
     */
    private async generateMonthlyReports() {
        logger.info('[Scheduler] Starting monthly report generation...');
        try {
            // Get all users
            const users = await UserRepository.findAll();

            const lastMonth = dayjs().subtract(1, 'month');
            const month = lastMonth.month() + 1; // 1-12
            const year = lastMonth.year();

            for (const user of users) {
                try {
                    logger.info(`[Scheduler] Generating report for user ${user.id}`);
                    const report = await ReportService.generateMonthlySummaryPDF(user.id, month, year);

                    // Send Email
                    // await EmailService.sendEmailWithAttachment(user.email, 'Your Monthly Report', 'Please find attached...', report);
                    logger.info(`[Scheduler] Report generated for ${user.email}`);
                } catch (err) {
                    logger.error(`[Scheduler] Failed report for ${user.id}`, err);
                }
            }
        } catch (err) {
            logger.error('[Scheduler] Global report generation failed', err);
        }
    }

    /**
     * Execute Budget Rollover
     */
    private async executeRollover() {
        logger.info('[Scheduler] Starting budget rollover...');
        try {
            const users = await UserRepository.findAll();
            const lastMonth = dayjs().subtract(1, 'month');
            const month = lastMonth.month() + 1;
            const year = lastMonth.year();
            const currentMonth = dayjs().month() + 1;
            const currentYear = dayjs().year();

            for (const user of users) {
                if (await BudgetRulesService.isRolloverEnabled(user.id)) {
                    await BudgetRulesService.executeRollover(user.id, month, year, currentMonth, currentYear);
                }
            }
        } catch (err) {
            logger.error('[Scheduler] Budget rollover failed', err);
        }
    }

    private async generateWeeklySummary() {
        // Implementation for weekly summary
        logger.info('[Scheduler] Weekly summary trigger');
    }
}
