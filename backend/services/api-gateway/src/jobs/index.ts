import { budgetAlertJob } from "./budget-alert.job";
import { billReminderJob } from "./bill-reminder.job";
import { analyticsComputationJob } from "./analytics-computation.job";
import { gmailWatchRenewalJob } from "./gmail-watch-renewal.job";
import { logger } from "shared/monitoring/logger";

export const initializeJobs = () => {
  logger.info("Initializing background jobs...");
  
  budgetAlertJob.start();
  billReminderJob.start();
  analyticsComputationJob.start();
  gmailWatchRenewalJob.start();

  logger.info("Background jobs initialized");
};
