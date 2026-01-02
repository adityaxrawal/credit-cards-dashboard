import * as alertsService from '@modules/alerts/alerts.service';
import { UserRepository } from '@modules/user/user.repository';
import { LoanRepository } from '@modules/loans/loan.repository';
import { AlertRepository } from '@modules/alerts/alerts.repository';
import dayjs from 'dayjs';

/**
 * EMI Reminder Job
 * Runs daily to send EMI payment reminders for upcoming loan EMIs
 */
export async function runEmiReminderJob() {
    console.log('[EmiReminderJob] Starting...');

    try {
        // Get all active users
        const users = await UserRepository.getAllActiveUsers();

        console.log(`[EmiReminderJob] Processing ${users.length} users`);

        const today = dayjs();
        const reminderDays = [7, 3, 1]; // Send reminders 7, 3, and 1 day before

        let remindersCreated = 0;

        for (const user of users) {
            try {
                // Get all active loans for the user
                const loans = await LoanRepository.findActiveByUserId(user.id);

                for (const loan of loans) {
                    // Calculate next EMI date if not set
                    let nextEmiDate = loan.next_emi_date;
                    if (!nextEmiDate && loan.emi_day) {
                        const thisMonthEmi = dayjs().date(loan.emi_day);
                        nextEmiDate = thisMonthEmi.isAfter(today)
                            ? thisMonthEmi.format('YYYY-MM-DD')
                            : thisMonthEmi.add(1, 'month').format('YYYY-MM-DD');
                    }

                    if (!nextEmiDate) continue;

                    const emiDate = dayjs(nextEmiDate);
                    const daysUntilEmi = emiDate.diff(today, 'day');

                    // Check if we should send a reminder
                    if (reminderDays.includes(daysUntilEmi)) {
                        console.log(`[EmiReminderJob] Sending EMI reminder for loan ${loan.id} (${daysUntilEmi} days)`);

                        const priority = daysUntilEmi === 1 ? 'critical' : daysUntilEmi === 3 ? 'high' : 'medium';

                        // Check if reminder already sent today
                        const existing = await AlertRepository.findExistingEmiAlert(user.id, loan.id);

                        if (!existing) {
                            await alertsService.createAlert(user.id, 'emi_reminder', {
                                title: `EMI Due: ${loan.loan_name}`,
                                message: daysUntilEmi === 1
                                    ? `Your EMI of ₹${loan.emi_amount.toLocaleString()} is due tomorrow!`
                                    : `Your EMI of ₹${loan.emi_amount.toLocaleString()} is due in ${daysUntilEmi} days (${emiDate.format('MMM DD')})`,
                                priority,
                                metadata: {
                                    loanId: loan.id,
                                    loanName: loan.loan_name,
                                    lenderName: loan.lender_name,
                                    emiAmount: loan.emi_amount,
                                    dueDate: nextEmiDate,
                                    remainingEmis: loan.remaining_emis,
                                    outstanding: loan.current_outstanding,
                                },
                            });

                            remindersCreated++;
                        }
                    }
                }
            } catch (error) {
                console.error(`[EmiReminderJob] Error processing user ${user.id}:`, error);
            }
        }

        console.log(`[EmiReminderJob] Created ${remindersCreated} EMI reminders`);
        console.log('[EmiReminderJob] Completed');
    } catch (error) {
        console.error('[EmiReminderJob] Job failed:', error);
        throw error;
    }
}

/**
 * Update next EMI dates after payment
 */
export async function updateEmiDatesJob() {
    console.log('[UpdateEmiDatesJob] Starting...');

    try {
        const today = dayjs().format('YYYY-MM-DD');

        // Get all loans with passed EMI dates
        const loans = await LoanRepository.findWithPassedEmiDate(today);

        for (const loan of loans) {
            const nextEmiDate = dayjs(loan.next_emi_date).add(1, 'month').format('YYYY-MM-DD');
            await LoanRepository.updateNextEmiDate(loan.id, nextEmiDate);
        }

        console.log(`[UpdateEmiDatesJob] Updated ${loans.length} loan EMI dates`);
        console.log('[UpdateEmiDatesJob] Completed');
    } catch (error) {
        console.error('[UpdateEmiDatesJob] Job failed:', error);
        throw error;
    }
}

// If run directly
if (require.main === module) {
    runEmiReminderJob()
        .then(() => updateEmiDatesJob())
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
