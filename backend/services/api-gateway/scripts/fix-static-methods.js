#!/usr/bin/env node

/**
 * Phase 3: Fix static vs instance method calls
 * Update controllers to use Service.method() instead of serviceInstance.method()
 */

const fs = require("fs");
const path = require("path");

console.log("🔧 Phase 3: Fixing static vs instance method calls...\n");

const srcDir = path.join(__dirname, "../src");

// Update controllers to use static methods directly

// 1. Alerts Controller
console.log("1️⃣ Fixing alerts controller...");
const alertsControllerPath = path.join(
  srcDir,
  "modules/alerts/alerts.controller.ts"
);
let alertsController = fs.readFileSync(alertsControllerPath, "utf8");

// Replace enhancedAlertService.method with EnhancedAlertService.method
alertsController = alertsController.replace(
  /enhancedAlertService\./g,
  "EnhancedAlertService."
);

// Add import for EnhancedAlertService class
if (!alertsController.includes("import { EnhancedAlertService }")) {
  alertsController = alertsController.replace(
    'import { enhancedAlertService } from "./alerts.service";',
    'import { EnhancedAlertService } from "./alerts.service";'
  );
}

fs.writeFileSync(alertsControllerPath, alertsController);
console.log("✅ Fixed alerts controller");

// 2. Analytics Controller
console.log("2️⃣ Fixing analytics controller...");
const analyticsControllerPath = path.join(
  srcDir,
  "modules/analytics/analytics.controller.ts"
);
let analyticsController = fs.readFileSync(analyticsControllerPath, "utf8");

analyticsController = analyticsController.replace(
  /advancedAnalyticsService\./g,
  "AdvancedAnalyticsService."
);

if (!analyticsController.includes("import { AdvancedAnalyticsService }")) {
  analyticsController = analyticsController.replace(
    'import { advancedAnalyticsService } from "./analytics.service";',
    'import { AdvancedAnalyticsService } from "./analytics.service";'
  );
}

fs.writeFileSync(analyticsControllerPath, analyticsController);
console.log("✅ Fixed analytics controller");

// 3. Bills Controller
console.log("3️⃣ Fixing bills controller...");
const billsControllerPath = path.join(
  srcDir,
  "modules/bills/bills.controller.ts"
);
let billsController = fs.readFileSync(billsControllerPath, "utf8");

billsController = billsController.replace(
  /billReminderService\./g,
  "BillReminderService."
);

if (!billsController.includes("import { BillReminderService }")) {
  billsController = billsController.replace(
    'import { billReminderService } from "./bills.service";',
    'import { BillReminderService } from "./bills.service";'
  );
}

fs.writeFileSync(billsControllerPath, billsController);
console.log("✅ Fixed bills controller");

// 4. Budgets Controller
console.log("4️⃣ Fixing budgets controller...");
const budgetsControllerPath = path.join(
  srcDir,
  "modules/budgets/budgets.controller.ts"
);
let budgetsController = fs.readFileSync(budgetsControllerPath, "utf8");

budgetsController = budgetsController.replace(
  /enhancedBudgetService\./g,
  "EnhancedBudgetService."
);

if (!budgetsController.includes("import { EnhancedBudgetService }")) {
  budgetsController = budgetsController.replace(
    'import { enhancedBudgetService } from "./budgets.service";',
    'import { EnhancedBudgetService } from "./budgets.service";'
  );
}

fs.writeFileSync(budgetsControllerPath, budgetsController);
console.log("✅ Fixed budgets controller");

// 5. Reports Controller
console.log("5️⃣ Fixing reports controller...");
const reportsControllerPath = path.join(
  srcDir,
  "modules/reports/reports.controller.ts"
);
let reportsController = fs.readFileSync(reportsControllerPath, "utf8");

reportsController = reportsController.replace(
  /reportingService\./g,
  "ReportingService."
);

if (!reportsController.includes("import { ReportingService }")) {
  reportsController = reportsController.replace(
    'import { reportingService } from "./reports.service";',
    'import { ReportingService } from "./reports.service";'
  );
}

fs.writeFileSync(reportsControllerPath, reportsController);
console.log("✅ Fixed reports controller");

// 6. Fix Bills Service - correct method names and alert service
console.log("6️⃣ Fixing bills service method implementations...");
const billsServicePath = path.join(srcDir, "modules/bills/bills.service.ts");
let billsService = fs.readFileSync(billsServicePath, "utf8");

// Fix the CRUD methods to use correct internal method names
billsService = billsService.replace(
  /static async createBill\(data: any\): Promise<any> \{\s+return await this\.createReminder\(data\);/g,
  "static async createBill(data: any): Promise<any> {\n    return await this.createBillReminder(data);"
);

billsService = billsService.replace(
  /static async getBills\(userId: string\): Promise<any> \{\s+return await this\.getAllReminders\(userId\);/g,
  "static async getBills(userId: string): Promise<any> {\n    return await this.getBillReminders(userId);"
);

billsService = billsService.replace(
  /static async updateBill\(id: string, data: any\): Promise<any> \{\s+return await this\.updateReminder\(id, data\);/g,
  'static async updateBill(id: string, data: any): Promise<any> {\n    const { data: updated } = await supabase.from("bill_reminders").update(data).eq("id", id).select().single();\n    return updated;'
);

billsService = billsService.replace(
  /static async deleteBill\(id: string\): Promise<void> \{\s+await this\.deleteReminder\(id\);/g,
  'static async deleteBill(id: string): Promise<void> {\n    await supabase.from("bill_reminders").delete().eq("id", id);'
);

// Fix alert service references - replace with static class calls
billsService = billsService.replace(
  /enhancedAlertService\./g,
  "EnhancedAlertService."
);

// Ensure EnhancedAlertService is imported
if (
  !billsService.includes("import { EnhancedAlertService }") &&
  billsService.includes("EnhancedAlertService.")
) {
  billsService = billsService.replace(
    'import { supabase } from "shared/database/supabase";',
    'import { supabase } from "shared/database/supabase";\nimport { EnhancedAlertService } from "../alerts/alerts.service";'
  );
}

fs.writeFileSync(billsServicePath, billsService);
console.log("✅ Fixed bills service");

// 7. Fix Analytics Service - correct method reference
console.log("7️⃣ Fixing analytics service method reference...");
const analyticsServicePath = path.join(
  srcDir,
  "modules/analytics/analytics.service.ts"
);
let analyticsService = fs.readFileSync(analyticsServicePath, "utf8");

// Fix getAnalytics to call existing method
analyticsService = analyticsService.replace(
  /return await this\.generateComprehensiveAnalytics\(/g,
  "return await AdvancedAnalyticsService.getDetailedAnalytics("
);

fs.writeFileSync(analyticsServicePath, analyticsService);
console.log("✅ Fixed analytics service");

// 8. Fix Alerts Service - correct method parameters
console.log("8️⃣ Fixing alerts service method signatures...");
const alertsServicePath = path.join(srcDir, "modules/alerts/alerts.service.ts");
let alertsService = fs.readFileSync(alertsServicePath, "utf8");

// Fix createAlert to use correct signature
alertsService = alertsService.replace(
  /static async createAlert\(data: any\): Promise<any> \{\s+return await this\.createAlertFromTemplate\(data\.userId, data\.type, data\);/g,
  `static async createAlert(data: any): Promise<any> {
    return await this.createAlertFromTemplate(
      data.userId,
      data.type || 'budget_exceeded',
      data.title || 'Alert',
      data.message || 'Alert message',
      { ...data }
    );`
);

// Fix getAlerts to use correct signature
alertsService = alertsService.replace(
  /return await this\.getAlertRules\(userId, \{ page: 1, limit: 100 \}\);/g,
  "return await this.getAlertRules(userId, true);"
);

fs.writeFileSync(alertsServicePath, alertsService);
console.log("✅ Fixed alerts service");

console.log("\n✅ Phase 3 complete!");
console.log("🔍 Run `npm run type-check` to verify all fixes.\n");
