import cron from "node-cron";
import { logger } from "shared/monitoring/logger";
import { supabase } from "shared/database/supabase";
import { budgetService } from "../modules/budgets/budgets.service";

/**
 * Budget Alert Job
 * Runs daily at 12:00 AM to check if users have exceeded their budget
 */
export const budgetAlertJob = cron.schedule("0 0 * * *", async () => {
  logger.info("Starting Budget Alert Job");
  try {
    // Get all active users
    const { data: users, error } = await supabase
      .from("users")
      .select("id")
      .eq("is_active", true);

    if (error) throw error;

    for (const user of users || []) {
      try {
        await budgetService.checkBudgetStatus(user.id);
      } catch (err) {
        logger.error(`Failed to check budget for user ${user.id}`, err as Error);
      }
    }
    logger.info("Budget Alert Job completed");
  } catch (error) {
    logger.error("Budget Alert Job failed", error as Error);
  }
});
