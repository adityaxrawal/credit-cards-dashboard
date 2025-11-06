#!/usr/bin/env node

/**
 * Fix Controllers to Use Actual Service Methods
 */

const fs = require("fs");
const path = require("path");

const MODULES_DIR = path.join(__dirname, "../src/modules");

// Module configurations with actual service method mappings
const modules = {
  cards: {
    service: "CardService",
    methods: {
      getAll: "getUserCards",
      getById: "getCardById",
      create: "addCard",
      update: "updateCard",
      delete: "deleteCard",
    },
  },
  transactions: {
    service: "TransactionService",
    methods: {
      getAll: "getTransactions",
      getById: "getTransactionById",
      create: "addTransaction",
      update: "updateTransaction",
      delete: "deleteTransaction",
    },
  },
  budgets: {
    service: "BudgetService",
    methods: {
      getAll: "getBudgets",
      getById: "getBudgetById",
      create: "createBudget",
      update: "updateBudget",
      delete: "deleteBudget",
    },
  },
  alerts: {
    service: "AlertService",
    methods: {
      getAll: "getAlerts",
      getById: "getAlertById",
      create: "createAlert",
      update: "updateAlert",
      delete: "deleteAlert",
    },
  },
  analytics: {
    service: "AnalyticsService",
    methods: {
      getAll: "getAnalytics",
      getById: "getAnalyticById",
    },
  },
  bills: {
    service: "BillService",
    methods: {
      getAll: "getBills",
      getById: "getBillById",
      create: "createBill",
      update: "updateBill",
      delete: "deleteBill",
    },
  },
  subscriptions: {
    service: "SubscriptionService",
    methods: {
      getAll: "getSubscriptions",
      getById: "getSubscriptionById",
      create: "createSubscription",
      update: "updateSubscription",
      delete: "deleteSubscription",
    },
  },
  rewards: {
    service: "RewardService",
    methods: {
      getAll: "getRewards",
      getById: "getRewardById",
    },
  },
  "ai-insights": {
    service: "AIInsightsService",
    methods: {
      getAll: "getInsights",
    },
  },
  reports: {
    service: "ReportService",
    methods: {
      getAll: "getReports",
      getById: "getReportById",
    },
  },
};

// Fix each controller
Object.keys(modules).forEach((moduleName) => {
  const config = modules[moduleName];
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

  // Fix service import - handle both patterns
  content = content.replace(
    /import { [A-Z][a-zA-Z]*Service } from/,
    `import { ${config.service} } from`
  );

  // Fix service class usage
  const oldPattern = new RegExp(`[A-Z][a-zA-Z]*Service\\.`, "g");
  content = content.replace(oldPattern, `${config.service}.`);

  // Fix method calls
  Object.keys(config.methods).forEach((genericMethod) => {
    const actualMethod = config.methods[genericMethod];
    const pattern = new RegExp(`${config.service}\\.${genericMethod}\\(`, "g");
    content = content.replace(pattern, `${config.service}.${actualMethod}(`);
  });

  fs.writeFileSync(controllerPath, content);
  console.log(`✅ Fixed ${moduleName} controller`);
});

console.log("\n🎉 All controllers fixed!");
