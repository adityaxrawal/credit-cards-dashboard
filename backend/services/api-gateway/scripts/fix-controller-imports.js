#!/usr/bin/env node

/**
 * Fix all controllers to use service instances and relative imports
 */

const fs = require("fs");
const path = require("path");

const MODULES_DIR = path.join(__dirname, "../src/modules");

const moduleConfigs = {
  cards: { service: "CardService", instance: "cardService" },
  transactions: {
    service: "TransactionService",
    instance: "transactionService",
  },
  budgets: {
    service: "EnhancedBudgetService",
    instance: "enhancedBudgetService",
  },
  alerts: { service: "EnhancedAlertService", instance: "enhancedAlertService" },
  analytics: {
    service: "AdvancedAnalyticsService",
    instance: "advancedAnalyticsService",
  },
  bills: { service: "BillReminderService", instance: "billReminderService" },
  subscriptions: {
    service: "SubscriptionService",
    instance: "subscriptionService",
  },
  rewards: { service: "RewardsService", instance: "rewardsService" },
  "ai-insights": {
    service: "AIInsightsService",
    instance: "aIInsightsService",
  },
  reports: { service: "ReportingService", instance: "reportingService" },
};

Object.keys(moduleConfigs).forEach((moduleName) => {
  const config = moduleConfigs[moduleName];
  const controllerPath = path.join(
    MODULES_DIR,
    moduleName,
    `${moduleName}.controller.ts`
  );

  if (!fs.existsSync(controllerPath)) {
    console.log(`⚠️  Controller not found: ${controllerPath}`);
    return;
  }

  let content = fs.readFileSync(controllerPath, "utf8");

  // Fix service import
  content = content.replace(
    /import { \w+Service } from/,
    `import { ${config.instance} } from`
  );

  // Fix @constants import to relative
  content = content.replace(
    /from ["']@constants["']/g,
    'from "../../constants"'
  );

  // Fix @utils/logger import to relative
  content = content.replace(
    /from ["']@utils\/logger["']/g,
    'from "../../utils/logger"'
  );

  // Replace all static service calls with instance calls
  const servicePattern = new RegExp(`${config.service}\\.`, "g");
  content = content.replace(servicePattern, `${config.instance}.`);

  fs.writeFileSync(controllerPath, content);
  console.log(`✅ Fixed ${moduleName} controller`);
});

console.log("\n🎉 All controllers fixed!");
