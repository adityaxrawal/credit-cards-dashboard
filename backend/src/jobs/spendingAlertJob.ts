import { UserRepository } from '../repositories/UserRepository';
import * as budgetService from '../services/bills/BudgetService';
import * as alertsService from '../services/alerts/AlertsService';
import logger from '../utils/infrastructure/logger';

/**
 * Spending Alert Job
 * Runs daily to check budget status and send alerts
 */
export async function runSpendingAlertJob() {
  logger.info('[SpendingAlertJob] Starting...');

  try {
    // Get all active users
    const users = await UserRepository.getAllActiveUsers();

    logger.info(`[SpendingAlertJob] Processing ${users.length} users`);

    for (const user of users) {
      try {
        const status = await budgetService.getCurrentBudgetStatus(user.id);

        // Send alert if critical or exceeded
        if (['critical', 'exceeded'].includes(status.status)) {
          logger.info(`[SpendingAlertJob] User ${user.id} budget status: ${status.status}`);

          await alertsService.createBudgetAlert(user.id, status);
          await budgetService.markAlertSent(user.id, status.month, status.year);

          logger.info(`[SpendingAlertJob] Alert sent for user ${user.id}`);
        }
      } catch (error) {
        logger.error(`[SpendingAlertJob] Error processing user ${user.id}:`, error);
      }
    }

    logger.info('[SpendingAlertJob] Completed');
  } catch (error) {
    logger.error('[SpendingAlertJob] Job failed:', error);
  }
}

// If run directly
if (require.main === module) {
  runSpendingAlertJob()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error(error);
      process.exit(1);
    });
}
