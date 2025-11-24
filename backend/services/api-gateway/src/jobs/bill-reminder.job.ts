import cron from "node-cron";
import { logger } from "shared/monitoring/logger";
import { supabase } from "shared/database/supabase";
import { billService } from "../modules/bills/bills.service";

/**
 * Bill Reminder Job
 * Runs daily at 9:00 AM to send reminders for upcoming bills
 */
export const billReminderJob = cron.schedule("0 9 * * *", async () => {
  logger.info("Starting Bill Reminder Job");
  try {
    // Get all active users
    const { data: users, error } = await supabase
      .from("users")
      .select("id")
      .eq("is_active", true);

    if (error) throw error;

    for (const user of users || []) {
      try {
        await billService.processReminders(user.id);
      } catch (err) {
        logger.error(`Failed to process bill reminders for user ${user.id}`, err as Error);
      }
    }
    logger.info("Bill Reminder Job completed");
  } catch (error) {
    logger.error("Bill Reminder Job failed", error as Error);
  }
});
