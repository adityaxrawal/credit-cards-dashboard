import pool from '../db';
import * as cardsQueries from '../db/queries/cards.queries';
import * as alertsService from '../services/alerts.service';
import { getCurrentBillingPeriod } from '../lib/billingCycle';
import dayjs from 'dayjs';

/**
 * Bill Reminder Job
 * Runs daily to send bill and due date reminders
 */
export async function runBillReminderJob() {
  console.log('[BillReminderJob] Starting...');
  
  try {
    // Get all active users
    const { rows: users } = await pool.query(
      'SELECT id, email FROM users WHERE is_active = true'
    );
    
    console.log(`[BillReminderJob] Processing ${users.length} users`);
    
    const today = dayjs();
    const reminderDays = 3; // Send reminder 3 days before
    
    for (const user of users) {
      try {
        const cards = await cardsQueries.getUserCards(user.id);
        
        for (const card of cards) {
          const currentPeriod = getCurrentBillingPeriod(card.bill_date, card.due_date);
          
          const billDate = dayjs(currentPeriod.billDate);
          const dueDate = dayjs(currentPeriod.dueDate);
          
          const daysToBill = billDate.diff(today, 'day');
          const daysToDue = dueDate.diff(today, 'day');
          
          // Send bill reminder
          if (daysToBill === reminderDays) {
            console.log(`[BillReminderJob] Sending bill reminder for card ${card.id}`);
            
            await alertsService.createBillReminder(user.id, {
              cardName: card.card_name,
              billDate: currentPeriod.billDate,
              dueDate: currentPeriod.dueDate,
            });
          }
          
          // Send due date reminder
          if (daysToDue === reminderDays) {
            console.log(`[BillReminderJob] Sending due date reminder for card ${card.id}`);
            
            await alertsService.createAlert(user.id, 'due_reminder', {
              title: `Payment Due: ${card.card_name}`,
              message: `Your payment is due in ${reminderDays} days (${dueDate.format('MMM DD')})`,
              priority: 'high',
              metadata: {
                cardId: card.id,
                dueDate: currentPeriod.dueDate,
              },
            });
          }
        }
      } catch (error) {
        console.error(`[BillReminderJob] Error processing user ${user.id}:`, error);
      }
    }
    
    console.log('[BillReminderJob] Completed');
  } catch (error) {
    console.error('[BillReminderJob] Job failed:', error);
  }
}

// If run directly
if (require.main === module) {
  runBillReminderJob()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
