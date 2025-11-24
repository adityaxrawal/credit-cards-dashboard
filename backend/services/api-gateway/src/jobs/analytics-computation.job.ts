import cron from "node-cron";
import { logger } from "shared/monitoring/logger";
import { supabase } from "shared/database/supabase";
import { analyticsService } from "../modules/analytics/analytics.service";

/**
 * Analytics Computation Job
 * Runs daily at 2:00 AM to pre-compute heavy analytics
 */
export const analyticsComputationJob = cron.schedule("0 2 * * *", async () => {
  logger.info("Starting Analytics Computation Job");
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id")
      .eq("is_active", true);

    if (error) throw error;

    for (const user of users || []) {
      try {
        await analyticsService.refreshCache(user.id);
      } catch (err) {
        logger.error(`Failed to compute analytics for user ${user.id}`, err as Error);
      }
    }
    logger.info("Analytics Computation Job completed");
  } catch (error) {
    logger.error("Analytics Computation Job failed", error as Error);
  }
});
