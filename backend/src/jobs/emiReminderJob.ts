import pool from '../lib/db';
import * as alertsService from '../services/alerts/AlertsService';
import dayjs from 'dayjs';

/**
 * EMI Reminder Job
 * Runs daily to send EMI payment reminders for upcoming loan EMIs
 */
export async function runEmiReminderJob() {
    console.log('[EmiReminderJob] Starting...');

    try {
        // Get all active users
        const { rows: users } = await pool.query(
            'SELECT id, email FROM users WHERE is_active = true'
        );

        console.log(`[EmiReminderJob] Processing ${users.length} users`);

        const today = dayjs();
        const reminderDays = [7, 3, 1]; // Send reminders 7, 3, and 1 day before

        let remindersCreated = 0;

        for (const user of users) {
            try {
                // Get all active loans for the user
                const { rows: loans } = await pool.query(
                    `SELECT id, loan_name, lender_name, emi_amount, emi_day, 
                  current_outstanding, remaining_emis, next_emi_date
           FROM loans 
           WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
                    [user.id]
                );

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
                        const { rows: existing } = await pool.query(
                            `SELECT id FROM alerts 
               WHERE user_id = $1 AND type = 'emi_reminder' 
               AND (metadata->>'loanId')::text = $2
               AND created_at::date = CURRENT_DATE`,
                            [user.id, loan.id]
                        );

                        if (existing.length === 0) {
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
        const { rows: loans } = await pool.query(
            `SELECT id, emi_day, next_emi_date 
       FROM loans 
       WHERE status = 'active' 
       AND deleted_at IS NULL
       AND next_emi_date < $1`,
            [today]
        );

        for (const loan of loans) {
            const nextEmiDate = dayjs(loan.next_emi_date).add(1, 'month').format('YYYY-MM-DD');

            await pool.query(
                'UPDATE loans SET next_emi_date = $1 WHERE id = $2',
                [nextEmiDate, loan.id]
            );
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
