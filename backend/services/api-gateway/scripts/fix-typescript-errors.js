#!/usr/bin/env node

/**
 * Script to fix all TypeScript errors in the backend
 * Runs systematically through each issue found during type-check
 */

const fs = require("fs");
const path = require("path");

console.log("🔧 Starting TypeScript error fixes...\n");

// Issue 1: Fix AI Insights Controller - typo in service name
console.log("1️⃣ Fixing AI Insights controller...");
const aiInsightsControllerPath = path.join(
  __dirname,
  "../src/modules/ai-insights/ai-insights.controller.ts"
);
let aiInsightsController = fs.readFileSync(aiInsightsControllerPath, "utf8");
aiInsightsController = aiInsightsController.replace(
  /aiaIInsightsService/g,
  "aIInsightsService"
);
fs.writeFileSync(aiInsightsControllerPath, aiInsightsController);
console.log("✅ Fixed AI Insights controller\n");

// Issue 2: Fix service imports in controllers - need to check each module's index.ts exports

console.log("2️⃣ Checking and fixing service exports...");

// Alerts module
const alertsIndexPath = path.join(__dirname, "../src/modules/alerts/index.ts");
let alertsIndex = fs.readFileSync(alertsIndexPath, "utf8");
if (!alertsIndex.includes("export { alertService }")) {
  alertsIndex = alertsIndex.replace(
    'export * from "./alerts.service";',
    'export * from "./alerts.service";\nexport { alertService } from "./alerts.service";'
  );
  fs.writeFileSync(alertsIndexPath, alertsIndex);
  console.log("✅ Fixed alerts module exports");
}

// Analytics module
const analyticsIndexPath = path.join(
  __dirname,
  "../src/modules/analytics/index.ts"
);
let analyticsIndex = fs.readFileSync(analyticsIndexPath, "utf8");
if (!analyticsIndex.includes("export { analyticsService }")) {
  analyticsIndex = analyticsIndex.replace(
    'export * from "./analytics.service";',
    'export * from "./analytics.service";\nexport { analyticsService } from "./analytics.service";'
  );
  fs.writeFileSync(analyticsIndexPath, analyticsIndex);
  console.log("✅ Fixed analytics module exports");
}

// Bills module
const billsIndexPath = path.join(__dirname, "../src/modules/bills/index.ts");
let billsIndex = fs.readFileSync(billsIndexPath, "utf8");
if (!billsIndex.includes("export { billService }")) {
  billsIndex = billsIndex.replace(
    'export * from "./bills.service";',
    'export * from "./bills.service";\nexport { billService } from "./bills.service";'
  );
  fs.writeFileSync(billsIndexPath, billsIndex);
  console.log("✅ Fixed bills module exports");
}

// Budgets module
const budgetsIndexPath = path.join(
  __dirname,
  "../src/modules/budgets/index.ts"
);
let budgetsIndex = fs.readFileSync(budgetsIndexPath, "utf8");
if (!budgetsIndex.includes("export { budgetService }")) {
  budgetsIndex = budgetsIndex.replace(
    'export * from "./budgets.service";',
    'export * from "./budgets.service";\nexport { budgetService } from "./budgets.service";'
  );
  fs.writeFileSync(budgetsIndexPath, budgetsIndex);
  console.log("✅ Fixed budgets module exports");
}

// Reports module
const reportsIndexPath = path.join(
  __dirname,
  "../src/modules/reports/index.ts"
);
let reportsIndex = fs.readFileSync(reportsIndexPath, "utf8");
if (!reportsIndex.includes("export { reportService }")) {
  reportsIndex = reportsIndex.replace(
    'export * from "./reports.service";',
    'export * from "./reports.service";\nexport { reportService } from "./reports.service";'
  );
  fs.writeFileSync(reportsIndexPath, reportsIndex);
  console.log("✅ Fixed reports module exports");
}

console.log("\n3️⃣ Fixing controller imports to use service instances...\n");

// Fix all controllers to import and use service instances properly
const controllerFixes = [
  {
    file: "../src/modules/alerts/alerts.controller.ts",
    oldImport: "",
    newImport: 'import { alertService } from "./alerts.service";',
    replacements: [
      { old: "AlertService.createAlert", new: "alertService.createAlert" },
      { old: "AlertService.getAlertById", new: "alertService.getAlertById" },
      { old: "AlertService.getAlerts", new: "alertService.getAlerts" },
      { old: "AlertService.updateAlert", new: "alertService.updateAlert" },
      { old: "AlertService.deleteAlert", new: "alertService.deleteAlert" },
    ],
  },
  {
    file: "../src/modules/analytics/analytics.controller.ts",
    oldImport: "",
    newImport: 'import { analyticsService } from "./analytics.service";',
    replacements: [
      { old: "AnalyticsService.create", new: "analyticsService.create" },
      {
        old: "AnalyticsService.getAnalyticById",
        new: "analyticsService.getAnalyticById",
      },
      {
        old: "AnalyticsService.getAnalytics",
        new: "analyticsService.getAnalytics",
      },
      { old: "AnalyticsService.update", new: "analyticsService.update" },
      { old: "AnalyticsService.delete", new: "analyticsService.delete" },
    ],
  },
  {
    file: "../src/modules/bills/bills.controller.ts",
    oldImport: "",
    newImport: 'import { billService } from "./bills.service";',
    replacements: [
      { old: "BillService.createBill", new: "billService.createBill" },
      { old: "BillService.getBillById", new: "billService.getBillById" },
      { old: "BillService.getBills", new: "billService.getBills" },
      { old: "BillService.updateBill", new: "billService.updateBill" },
      { old: "BillService.deleteBill", new: "billService.deleteBill" },
    ],
  },
  {
    file: "../src/modules/budgets/budgets.controller.ts",
    oldImport: "",
    newImport: 'import { budgetService } from "./budgets.service";',
    replacements: [
      { old: "BudgetService.createBudget", new: "budgetService.createBudget" },
      {
        old: "BudgetService.getBudgetById",
        new: "budgetService.getBudgetById",
      },
      { old: "BudgetService.getBudgets", new: "budgetService.getBudgets" },
      { old: "BudgetService.updateBudget", new: "budgetService.updateBudget" },
      { old: "BudgetService.deleteBudget", new: "budgetService.deleteBudget" },
    ],
  },
  {
    file: "../src/modules/reports/reports.controller.ts",
    oldImport: "",
    newImport: 'import { reportService } from "./reports.service";',
    replacements: [
      { old: "ReportService.create", new: "reportService.create" },
      {
        old: "ReportService.getReportById",
        new: "reportService.getReportById",
      },
      { old: "ReportService.getReports", new: "reportService.getReports" },
      { old: "ReportService.update", new: "reportService.update" },
      { old: "ReportService.delete", new: "reportService.delete" },
    ],
  },
];

controllerFixes.forEach((fix) => {
  const filePath = path.join(__dirname, fix.file);
  let content = fs.readFileSync(filePath, "utf8");

  // Add import if not present
  if (fix.newImport && !content.includes(fix.newImport)) {
    const lines = content.split("\n");
    const lastImportIndex =
      lines.findIndex((line) => line.startsWith("import")) + 1;
    lines.splice(lastImportIndex, 0, fix.newImport);
    content = lines.join("\n");
  }

  // Apply all replacements
  fix.replacements.forEach((replacement) => {
    content = content.replace(
      new RegExp(replacement.old, "g"),
      replacement.new
    );
  });

  fs.writeFileSync(filePath, content);
  console.log(`✅ Fixed ${path.basename(fix.file)}`);
});

console.log("\n4️⃣ Fixing bills.service.ts AlertService references...\n");
const billsServicePath = path.join(
  __dirname,
  "../src/modules/bills/bills.service.ts"
);
let billsService = fs.readFileSync(billsServicePath, "utf8");

// Add import for alertService
if (!billsService.includes("import { alertService }")) {
  billsService = billsService.replace(
    'import { supabase } from "shared/database/supabase";',
    'import { supabase } from "shared/database/supabase";\nimport { alertService } from "../alerts/alerts.service";'
  );
}

// Replace AlertService with alertService
billsService = billsService.replace(
  /AlertService\.createAlert/g,
  "alertService.createAlert"
);
fs.writeFileSync(billsServicePath, billsService);
console.log("✅ Fixed bills.service.ts\n");

console.log("✅ All fixes applied successfully!\n");
console.log("🔍 Run `npm run type-check` to verify fixes.\n");
