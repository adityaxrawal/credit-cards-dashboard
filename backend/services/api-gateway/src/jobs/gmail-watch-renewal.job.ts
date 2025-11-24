import cron from "node-cron";
import { logger } from "shared/monitoring/logger";
import { supabase } from "shared/database/supabase";
import { gmailService } from "../modules/gmail/gmail.service";

/**
 * Gmail Watch Renewal Job
 * Runs every 6 days to renew Gmail Pub/Sub watch (expires in 7 days)
 */
export const gmailWatchRenewalJob = cron.schedule("0 0 */6 * *", async () => {
  logger.info("Starting Gmail Watch Renewal Job");
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id")
      .eq("is_active", true)
      .not("gmail_refresh_token", "is", null);

    if (error) throw error;

    for (const user of users || []) {
      try {
        await gmailService.renewWatch(user.id);
      } catch (err) {
        logger.error(`Failed to renew Gmail watch for user ${user.id}`, err as Error);
      }
    }
    logger.info("Gmail Watch Renewal Job completed");
  } catch (error) {
    logger.error("Gmail Watch Renewal Job failed", error as Error);
  }
});
