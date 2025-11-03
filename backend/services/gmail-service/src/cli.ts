#!/usr/bin/env node

/**
 * CLI tool for Gmail Service operations
 * Usage: node cli.js <command> [options]
 */

import { historicalScanner } from "./scanner/historical-scanner";
import { emailQueue } from "./queue/email-queue";
import { notificationService } from "./notifications/notification-service";
import { logger } from "./utils/logger";

const commands = {
  // Start historical scan
  scan: async (args: string[]) => {
    const userId = args[0];
    const startDate = args[1];
    const endDate = args[2];

    if (!userId || !startDate || !endDate) {
      console.error("Usage: cli scan <userId> <startDate> <endDate>");
      console.error("Example: cli scan user-123 2024-01-01 2024-01-31");
      process.exit(1);
    }

    console.log(`Starting historical scan for user ${userId}...`);
    console.log(`Date range: ${startDate} to ${endDate}`);

    try {
      const jobId = await historicalScanner.startScan({
        userId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      console.log(`\n✅ Scan started successfully!`);
      console.log(`Job ID: ${jobId}`);
      console.log(`\nTo check progress, run: cli progress ${jobId}`);
    } catch (error) {
      console.error("❌ Failed to start scan:", error);
      process.exit(1);
    }
  },

  // Check scan progress
  progress: async (args: string[]) => {
    const jobId = args[0];

    if (!jobId) {
      console.error("Usage: cli progress <jobId>");
      process.exit(1);
    }

    try {
      const progress = await historicalScanner.getProgress(jobId);

      if (!progress) {
        console.error(`❌ Job ${jobId} not found`);
        process.exit(1);
      }

      console.log(`\n📊 Scan Progress - Job ${jobId}`);
      console.log("━".repeat(60));
      console.log(`Status: ${progress.status.toUpperCase()}`);
      console.log(`Progress: ${progress.progressPercentage.toFixed(2)}%`);
      console.log(`\nMessages:`);
      console.log(`  Total: ${progress.totalMessages.toLocaleString()}`);
      console.log(`  Processed: ${progress.processedMessages.toLocaleString()}`);
      console.log(`  Extracted: ${progress.extractedTransactions.toLocaleString()}`);
      console.log(`  Failed: ${progress.failedMessages.toLocaleString()}`);
      console.log(`  Duplicates: ${progress.duplicateMessages.toLocaleString()}`);

      if (progress.startedAt) {
        console.log(`\nStarted: ${new Date(progress.startedAt).toLocaleString()}`);
      }

      if (progress.completedAt) {
        console.log(`Completed: ${new Date(progress.completedAt).toLocaleString()}`);
      }

      if (progress.estimatedCompletion && progress.status === "running") {
        console.log(
          `Estimated completion: ${new Date(progress.estimatedCompletion).toLocaleString()}`
        );
      }

      console.log("━".repeat(60));
    } catch (error) {
      console.error("❌ Failed to get progress:", error);
      process.exit(1);
    }
  },

  // Pause scan
  pause: async (args: string[]) => {
    const jobId = args[0];

    if (!jobId) {
      console.error("Usage: cli pause <jobId>");
      process.exit(1);
    }

    try {
      await historicalScanner.pauseScan(jobId);
      console.log(`✅ Scan job ${jobId} paused`);
    } catch (error) {
      console.error("❌ Failed to pause scan:", error);
      process.exit(1);
    }
  },

  // Resume scan
  resume: async (args: string[]) => {
    const jobId = args[0];

    if (!jobId) {
      console.error("Usage: cli resume <jobId>");
      process.exit(1);
    }

    try {
      await historicalScanner.resumeScan(jobId);
      console.log(`✅ Scan job ${jobId} resumed`);
    } catch (error) {
      console.error("❌ Failed to resume scan:", error);
      process.exit(1);
    }
  },

  // Queue stats
  "queue-stats": async () => {
    try {
      const stats = await emailQueue.getStats();

      console.log(`\n📊 Email Queue Statistics`);
      console.log("━".repeat(60));
      console.log(`Pending: ${stats.pending.toLocaleString()}`);
      console.log(`Processing: ${stats.processing.toLocaleString()}`);
      console.log(`Delayed: ${stats.delayed.toLocaleString()}`);
      console.log(`Dead Letter Queue: ${stats.dlq.toLocaleString()}`);
      console.log("━".repeat(60));
    } catch (error) {
      console.error("❌ Failed to get queue stats:", error);
      process.exit(1);
    }
  },

  // Send test notification
  "test-notification": async (args: string[]) => {
    const userId = args[0];

    if (!userId) {
      console.error("Usage: cli test-notification <userId>");
      process.exit(1);
    }

    try {
      await notificationService.createNotification({
        user_id: userId,
        type: "info",
        title: "Test Notification",
        message: "This is a test notification from the CLI",
      });

      console.log(`✅ Test notification sent to user ${userId}`);
    } catch (error) {
      console.error("❌ Failed to send notification:", error);
      process.exit(1);
    }
  },

  // Help command
  help: async () => {
    console.log(`
Gmail Service CLI Tool

Usage: cli <command> [options]

Commands:
  scan <userId> <startDate> <endDate>   Start historical email scan
  progress <jobId>                      Check scan progress
  pause <jobId>                         Pause scan job
  resume <jobId>                        Resume scan job
  queue-stats                           Show email queue statistics
  test-notification <userId>            Send test notification
  help                                  Show this help message

Examples:
  cli scan user-123 2024-01-01 2024-01-31
  cli progress abc-123-def
  cli pause abc-123-def
  cli resume abc-123-def
  cli queue-stats
  cli test-notification user-123
    `);
  },
};

// Parse arguments and execute command
const main = async () => {
  const [, , command, ...args] = process.argv;

  if (!command || !(command in commands)) {
    console.error(`Unknown command: ${command || "(none)"}`);
    console.log('Run "cli help" for usage information');
    process.exit(1);
  }

  try {
    await (commands as any)[command](args);
    process.exit(0);
  } catch (error) {
    logger.error({ error, command }, "CLI command failed");
    process.exit(1);
  }
};

// Run CLI
if (require.main === module) {
  main();
}

export default commands;
