import * as cron from "node-cron";
import { AlertService } from "../services/alert.service";
import { BillReminderService } from "../services/bill-reminder.service";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Background Job Service - Handles scheduled tasks for alerts and notifications
 */
export class BackgroundJobService {
  private static jobs: Map<string, any> = new Map();

  /**
   * Start all background jobs
   */
  static startAllJobs(): void {
    console.log("Starting background jobs...");

    // Daily budget alert check - runs every hour during business hours (9 AM to 11 PM IST)
    this.scheduleJob("budget-alerts", "0 9-23 * * *", async () => {
      console.log("Running budget alert check...");
      await this.runBudgetAlertCheck();
    });

    // Bill reminder check - runs daily at 9 AM IST
    this.scheduleJob("bill-reminders", "0 9 * * *", async () => {
      console.log("Running bill reminder check...");
      await this.runBillReminderCheck();
    });

    // Unusual activity detection - runs every 4 hours
    this.scheduleJob("unusual-activity", "0 */4 * * *", async () => {
      console.log("Running unusual activity detection...");
      await this.runUnusualActivityCheck();
    });

    // Budget tracking update - runs every 30 minutes to update spending totals
    this.scheduleJob("budget-tracking-update", "*/30 * * * *", async () => {
      console.log("Updating budget tracking...");
      await this.updateBudgetTracking();
    });

    // Daily digest notification - runs at 8 PM IST for users who prefer daily digest
    this.scheduleJob("daily-digest", "0 20 * * *", async () => {
      console.log("Sending daily digest notifications...");
      await this.sendDailyDigest();
    });

    // Weekly digest notification - runs every Sunday at 9 AM IST
    this.scheduleJob("weekly-digest", "0 9 * * 0", async () => {
      console.log("Sending weekly digest notifications...");
      await this.sendWeeklyDigest();
    });

    // Bill generation - runs daily at 6 AM IST to check for new bills
    this.scheduleJob("bill-generation", "0 6 * * *", async () => {
      console.log("Running bill generation check...");
      await this.runBillGeneration();
    });

    // Overdue bill check - runs daily at 10 AM IST
    this.scheduleJob("overdue-bill-check", "0 10 * * *", async () => {
      console.log("Checking for overdue bills...");
      await this.runOverdueBillCheck();
    });

    // Recurring transactions processor - runs every hour
    this.scheduleJob("recurring-transactions", "0 * * * *", async () => {
      console.log("Processing recurring transactions...");
      await this.processRecurringTransactions();
    });

    console.log(`Started ${this.jobs.size} background jobs`);
  }

  /**
   * Stop all background jobs
   */
  static stopAllJobs(): void {
    console.log("Stopping background jobs...");

    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });

    this.jobs.clear();
    console.log("All background jobs stopped");
  }

  /**
   * Get status of all jobs
   */
  static getJobsStatus(): {
    [jobName: string]: { running: boolean; nextRun?: string };
  } {
    const status: {
      [jobName: string]: { running: boolean; nextRun?: string };
    } = {};

    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
        nextRun: "Next execution scheduled",
      };
    });

    return status;
  }

  /**
   * Run a specific job manually
   */
  static async runJob(jobName: string): Promise<void> {
    switch (jobName) {
      case "budget-alerts":
        await this.runBudgetAlertCheck();
        break;
      case "bill-reminders":
        await this.runBillReminderCheck();
        break;
      case "unusual-activity":
        await this.runUnusualActivityCheck();
        break;
      case "budget-tracking-update":
        await this.updateBudgetTracking();
        break;
      case "daily-digest":
        await this.sendDailyDigest();
        break;
      case "weekly-digest":
        await this.sendWeeklyDigest();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  // Private helper methods

  private static scheduleJob(
    name: string,
    cronExpression: string,
    jobFunction: () => Promise<void>
  ): void {
    const job = cron.schedule(
      cronExpression,
      async () => {
        try {
          await jobFunction();
        } catch (error) {
          console.error(`Error in job ${name}:`, error);
        }
      },
      {
        timezone: "Asia/Kolkata", // IST timezone
      }
    );

    this.jobs.set(name, job);
    console.log(`Scheduled job: ${name} with cron: ${cronExpression}`);
  }

  private static async runBudgetAlertCheck(): Promise<void> {
    try {
      // Get all active users
      const { data: users, error } = await supabase
        .from("users")
        .select("id")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching users for budget alerts:", error);
        return;
      }

      if (!users || users.length === 0) {
        console.log("No active users found for budget alert check");
        return;
      }

      console.log(`Checking budget alerts for ${users.length} users`);
      let alertsGenerated = 0;

      // Generate budget alerts for each user
      for (const user of users) {
        try {
          const beforeCount = await this.getAlertCount(user.id);
          await AlertService.generateBudgetAlerts(user.id);
          const afterCount = await this.getAlertCount(user.id);

          if (afterCount > beforeCount) {
            alertsGenerated += afterCount - beforeCount;
          }
        } catch (error) {
          console.error(
            `Error generating budget alerts for user ${user.id}:`,
            error
          );
        }
      }

      console.log(
        `Budget alert check completed. Generated ${alertsGenerated} new alerts`
      );
    } catch (error) {
      console.error("Error in budget alert check:", error);
    }
  }

  private static async runBillReminderCheck(): Promise<void> {
    try {
      await AlertService.generateBillReminders();
      console.log("Bill reminder check completed successfully");
    } catch (error) {
      console.error("Error in bill reminder check:", error);
    }
  }

  private static async runUnusualActivityCheck(): Promise<void> {
    try {
      // Get all active users
      const { data: users, error } = await supabase
        .from("users")
        .select("id")
        .eq("is_active", true);

      if (error) {
        console.error(
          "Error fetching users for unusual activity check:",
          error
        );
        return;
      }

      if (!users || users.length === 0) {
        console.log("No active users found for unusual activity check");
        return;
      }

      console.log(`Checking unusual activity for ${users.length} users`);
      let alertsGenerated = 0;

      // Check unusual activity for each user
      for (const user of users) {
        try {
          const beforeCount = await this.getAlertCount(user.id);
          await AlertService.detectUnusualActivity(user.id);
          const afterCount = await this.getAlertCount(user.id);

          if (afterCount > beforeCount) {
            alertsGenerated += afterCount - beforeCount;
          }
        } catch (error) {
          console.error(
            `Error detecting unusual activity for user ${user.id}:`,
            error
          );
        }
      }

      console.log(
        `Unusual activity check completed. Generated ${alertsGenerated} new alerts`
      );
    } catch (error) {
      console.error("Error in unusual activity check:", error);
    }
  }

  private static async updateBudgetTracking(): Promise<void> {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Get all budget tracking records for current month
      const { data: budgetRecords, error } = await supabase
        .from("budget_tracking")
        .select("id, user_id, budget_limit")
        .eq("month", month)
        .eq("year", year);

      if (error) {
        console.error("Error fetching budget records:", error);
        return;
      }

      if (!budgetRecords || budgetRecords.length === 0) {
        console.log("No budget records found for current month");
        return;
      }

      console.log(
        `Updating budget tracking for ${budgetRecords.length} records`
      );
      let updatedRecords = 0;

      for (const record of budgetRecords) {
        try {
          // Calculate current month spending
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);

          const { data: transactions, error: transactionError } = await supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", record.user_id)
            .eq("transaction_type", "debit")
            .gte("transaction_date", startDate.toISOString())
            .lte("transaction_date", endDate.toISOString());

          if (transactionError) {
            console.error(
              `Error fetching transactions for user ${record.user_id}:`,
              transactionError
            );
            continue;
          }

          const totalSpent = (transactions || []).reduce(
            (sum, t) => sum + Number(t.amount),
            0
          );

          // Update budget record if spending changed
          const { error: updateError } = await supabase
            .from("budget_tracking")
            .update({
              total_spent: totalSpent,
              updated_at: new Date().toISOString(),
            })
            .eq("id", record.id);

          if (updateError) {
            console.error(
              `Error updating budget record ${record.id}:`,
              updateError
            );
            continue;
          }

          updatedRecords++;
        } catch (error) {
          console.error(`Error processing budget record ${record.id}:`, error);
        }
      }

      console.log(
        `Budget tracking update completed. Updated ${updatedRecords} records`
      );
    } catch (error) {
      console.error("Error in budget tracking update:", error);
    }
  }

  private static async sendDailyDigest(): Promise<void> {
    try {
      // Get users who prefer daily digest
      const { data: users, error } = await supabase
        .from("users")
        .select("id, email")
        .eq("is_active", true);
      // In a real app, you would join with user_preferences to filter for daily digest preference

      if (error || !users) {
        console.error("Error fetching users for daily digest:", error);
        return;
      }

      console.log(`Sending daily digest to ${users.length} users`);
      let digestsSent = 0;

      for (const user of users) {
        try {
          // Get today's alerts
          const today = new Date();
          const startOfDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          ).toISOString();
          const endOfDay = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59
          ).toISOString();

          const { data: todaysAlerts, error: alertsError } = await supabase
            .from("alerts")
            .select("*")
            .eq("user_id", user.id)
            .gte("created_at", startOfDay)
            .lte("created_at", endOfDay)
            .order("created_at", { ascending: false });

          if (alertsError) {
            console.error(
              `Error fetching alerts for user ${user.id}:`,
              alertsError
            );
            continue;
          }

          if (todaysAlerts && todaysAlerts.length > 0) {
            // Send digest email (placeholder)
            console.log(
              `Sending daily digest to ${user.email} with ${todaysAlerts.length} alerts`
            );
            // await emailService.sendDailyDigest(user.email, todaysAlerts);
            digestsSent++;
          }
        } catch (error) {
          console.error(
            `Error sending daily digest to user ${user.id}:`,
            error
          );
        }
      }

      console.log(`Daily digest completed. Sent ${digestsSent} digests`);
    } catch (error) {
      console.error("Error in daily digest:", error);
    }
  }

  private static async sendWeeklyDigest(): Promise<void> {
    try {
      // Get users who prefer weekly digest
      const { data: users, error } = await supabase
        .from("users")
        .select("id, email")
        .eq("is_active", true);
      // In a real app, you would join with user_preferences to filter for weekly digest preference

      if (error || !users) {
        console.error("Error fetching users for weekly digest:", error);
        return;
      }

      console.log(`Sending weekly digest to ${users.length} users`);
      let digestsSent = 0;

      for (const user of users) {
        try {
          // Get this week's alerts
          const today = new Date();
          const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          const startOfWeek = new Date(
            weekStart.getFullYear(),
            weekStart.getMonth(),
            weekStart.getDate()
          ).toISOString();
          const endOfWeek = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59
          ).toISOString();

          const { data: weeklyAlerts, error: alertsError } = await supabase
            .from("alerts")
            .select("*")
            .eq("user_id", user.id)
            .gte("created_at", startOfWeek)
            .lte("created_at", endOfWeek)
            .order("created_at", { ascending: false });

          if (alertsError) {
            console.error(
              `Error fetching weekly alerts for user ${user.id}:`,
              alertsError
            );
            continue;
          }

          if (weeklyAlerts && weeklyAlerts.length > 0) {
            // Send digest email (placeholder)
            console.log(
              `Sending weekly digest to ${user.email} with ${weeklyAlerts.length} alerts`
            );
            // await emailService.sendWeeklyDigest(user.email, weeklyAlerts);
            digestsSent++;
          }
        } catch (error) {
          console.error(
            `Error sending weekly digest to user ${user.id}:`,
            error
          );
        }
      }

      console.log(`Weekly digest completed. Sent ${digestsSent} digests`);
    } catch (error) {
      console.error("Error in weekly digest:", error);
    }
  }

  private static async getAlertCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      console.error(`Error getting alert count for user ${userId}:`, error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Run bill generation check
   */
  private static async runBillGeneration(): Promise<void> {
    try {
      console.log("Starting bill generation process...");
      const result = await BillReminderService.generateBillsForAllCards();
      console.log(
        `Bill generation completed. Generated: ${result.generated}, Updated: ${result.updated}, Errors: ${result.errors.length}`
      );

      if (result.errors.length > 0) {
        console.error("Bill generation errors:", result.errors);
      }
    } catch (error) {
      console.error("Error in bill generation:", error);
    }
  }

  /**
   * Run overdue bill check
   */
  private static async runOverdueBillCheck(): Promise<void> {
    try {
      console.log("Starting overdue bill check...");
      const result = await BillReminderService.checkOverdueBills();
      console.log(
        `Overdue bill check completed. Updated: ${result.updated}, Notified: ${result.notified}`
      );
    } catch (error) {
      console.error("Error in overdue bill check:", error);
    }
  }

  /**
   * Process recurring transactions
   */
  private static async processRecurringTransactions(): Promise<void> {
    try {
      console.log("Starting recurring transaction processing...");
      const { RecurringTransactionService } = await import(
        "./recurring-transaction.service"
      );
      const result =
        await RecurringTransactionService.processDueRecurringTransactions();
      console.log(
        `Recurring transactions processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`
      );
    } catch (error) {
      console.error("Error in overdue bill check:", error);
    }
  }
}
