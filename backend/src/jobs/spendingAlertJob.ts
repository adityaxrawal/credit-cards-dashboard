import pool from '../lib/db';
import * as budgetService from '../services/budget.service';
import * as alertsService from '../services/alerts.service';

/**
 * Spending Alert Job
 * Runs daily to check budget status and send alerts
 */
export async function runSpendingAlertJob() {
  console.log('[SpendingAlertJob] Starting...');
  
  try {
    // Get all active users
    const { rows: users } = await pool.query(
      'SELECT id, email, monthly_budget FROM users WHERE is_active = true'
    );
    
    console.log(`[SpendingAlertJob] Processing ${users.length} users`);
    
    for (const user of users) {
      try {
        const status = await budgetService.getCurrentBudgetStatus(user.id);
        
        // Send alert if critical or exceeded
        if (['critical', 'exceeded'].includes(status.status)) {
          console.log(`[SpendingAlertJob] User ${user.id} budget status: ${status.status}`);
          
          await alertsService.createBudgetAlert(user.id, status);
          await budgetService.markAlertSent(user.id, status.month, status.year);
          
          console.log(`[SpendingAlertJob] Alert sent for user ${user.id}`);
        }
      } catch (error) {
        console.error(`[SpendingAlertJob] Error processing user ${user.id}:`, error);
      }
    }
    
    console.log('[SpendingAlertJob] Completed');
  } catch (error) {
    console.error('[SpendingAlertJob] Job failed:', error);
  }
}

// If run directly
if (require.main === module) {
  runSpendingAlertJob()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
