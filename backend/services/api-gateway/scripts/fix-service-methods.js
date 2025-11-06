#!/usr/bin/env node

/**
 * Phase 2: Fix remaining service method mismatches
 * Creates wrapper methods or updates controllers to use correct service methods
 */

const fs = require("fs");
const path = require("path");

console.log("🔧 Phase 2: Fixing service method mismatches...\n");

const srcDir = path.join(__dirname, "../src");

// =====================================================
// Strategy: Add CRUD wrapper methods to each service
// =====================================================

// 1. Alerts Service - Add CRUD methods
console.log("1️⃣ Adding CRUD methods to alerts service...");
const alertsServicePath = path.join(srcDir, "modules/alerts/alerts.service.ts");
let alertsService = fs.readFileSync(alertsServicePath, "utf8");

const alertsCRUD = `
  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async createAlert(data: any): Promise<any> {
    return await this.createAlertFromTemplate(data.userId, data.type, data);
  }

  static async getAlertById(id: string): Promise<any> {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  static async getAlerts(userId: string): Promise<any> {
    return await this.getAlertRules(userId, { page: 1, limit: 100 });
  }

  static async updateAlert(id: string, data: any): Promise<any> {
    return await this.updateAlertRule(id, data.userId, data);
  }

  static async deleteAlert(id: string): Promise<void> {
    await this.deleteAlertRule(id, '');
  }
`;

// Insert before the closing brace of the class
alertsService = alertsService.replace(
  /^}(\s+\/\/ Export singleton)/m,
  `${alertsCRUD}\n}\n$1`
);
fs.writeFileSync(alertsServicePath, alertsService);
console.log("✅ Added CRUD methods to alerts service");

// 2. Analytics Service - Add CRUD methods
console.log("2️⃣ Adding CRUD methods to analytics service...");
const analyticsServicePath = path.join(
  srcDir,
  "modules/analytics/analytics.service.ts"
);
let analyticsService = fs.readFileSync(analyticsServicePath, "utf8");

const analyticsCRUD = `
  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async create(data: any): Promise<any> {
    // Analytics are computed, not created directly
    return { message: "Analytics are auto-generated" };
  }

  static async getAnalyticById(id: string): Promise<any> {
    return { id, message: "Use getAnalytics instead" };
  }

  static async getAnalytics(userId: string): Promise<any> {
    return await this.generateComprehensiveAnalytics(userId, {
      period: 'month',
      includeForecasts: true
    });
  }

  static async update(id: string, data: any): Promise<any> {
    return { message: "Analytics are read-only" };
  }

  static async delete(id: string): Promise<void> {
    // Analytics cannot be deleted
  }
`;

analyticsService = analyticsService.replace(
  /^}(\s+\/\/ Export singleton)/m,
  `${analyticsCRUD}\n}\n$1`
);
fs.writeFileSync(analyticsServicePath, analyticsService);
console.log("✅ Added CRUD methods to analytics service");

// 3. Bills Service - Add CRUD methods
console.log("3️⃣ Adding CRUD methods to bills service...");
const billsServicePath = path.join(srcDir, "modules/bills/bills.service.ts");
let billsService = fs.readFileSync(billsServicePath, "utf8");

const billsCRUD = `
  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async createBill(data: any): Promise<any> {
    return await this.createReminder(data);
  }

  static async getBillById(id: string): Promise<any> {
    const { data } = await supabase
      .from('bill_reminders')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  static async getBills(userId: string): Promise<any> {
    return await this.getAllReminders(userId);
  }

  static async updateBill(id: string, data: any): Promise<any> {
    return await this.updateReminder(id, data);
  }

  static async deleteBill(id: string): Promise<void> {
    await this.deleteReminder(id);
  }
`;

billsService = billsService.replace(
  /^}(\s+\/\/ Export singleton)/m,
  `${billsCRUD}\n}\n$1`
);
fs.writeFileSync(billsServicePath, billsService);
console.log("✅ Added CRUD methods to bills service");

// 4. Budgets Service - Add CRUD methods
console.log("4️⃣ Adding CRUD methods to budgets service...");
const budgetsServicePath = path.join(
  srcDir,
  "modules/budgets/budgets.service.ts"
);
let budgetsService = fs.readFileSync(budgetsServicePath, "utf8");

const budgetsCRUD = `
  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async createBudget(data: any): Promise<any> {
    return await this.createCategoryBudget(data.userId, data);
  }

  static async getBudgetById(id: string): Promise<any> {
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  static async getBudgets(userId: string): Promise<any> {
    return await this.getCategoryBudgets(userId);
  }

  static async updateBudget(id: string, data: any): Promise<any> {
    return await this.updateCategoryBudget(id, data.userId, data);
  }

  static async deleteBudget(id: string): Promise<void> {
    await supabase.from('budgets').delete().eq('id', id);
  }
`;

budgetsService = budgetsService.replace(
  /^}(\s+\/\/ Export singleton)/m,
  `${budgetsCRUD}\n}\n$1`
);
fs.writeFileSync(budgetsServicePath, budgetsService);
console.log("✅ Added CRUD methods to budgets service");

// 5. Reports Service - Add CRUD methods
console.log("5️⃣ Adding CRUD methods to reports service...");
const reportsServicePath = path.join(
  srcDir,
  "modules/reports/reports.service.ts"
);
let reportsService = fs.readFileSync(reportsServicePath, "utf8");

const reportsCRUD = `
  /**
   * CRUD Wrapper Methods for API Controller
   */
  static async create(data: any): Promise<any> {
    return await this.generateReport(data.userId, data.type, data);
  }

  static async getReportById(id: string): Promise<any> {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  static async getReports(userId: string): Promise<any> {
    return await this.getReportHistory(userId, 50);
  }

  static async update(id: string, data: any): Promise<any> {
    // Reports are immutable, regenerate instead
    return { message: "Reports cannot be updated, generate a new one" };
  }

  static async delete(id: string): Promise<void> {
    await this.deleteReport(id);
  }
`;

reportsService = reportsService.replace(
  /^}(\s+\/\/ Export singleton)/m,
  `${reportsCRUD}\n}\n$1`
);
fs.writeFileSync(reportsServicePath, reportsService);
console.log("✅ Added CRUD methods to reports service");

// 6. Rewards Service - Check existing methods and add wrappers if needed
console.log("6️⃣ Checking rewards service methods...");
const rewardsServicePath = path.join(
  srcDir,
  "modules/rewards/rewards.service.ts"
);
let rewardsService = fs.readFileSync(rewardsServicePath, "utf8");

// Check if methods already exist
if (!rewardsService.includes("async trackReward(")) {
  const rewardsCRUD = `
  /**
   * CRUD Wrapper Methods for API Controller
   */
  async trackReward(data: any): Promise<any> {
    return await RewardsService.trackCardReward(data.cardId, data.transactionId, data);
  }

  async getReward(id: string): Promise<any> {
    const { data } = await supabase
      .from('rewards')
      .select('*')
      .eq('id', id)
      .single();
    return data;
  }

  async getUserRewards(userId: string): Promise<any> {
    return await RewardsService.getRewardsHistory(userId, {});
  }

  async updateReward(id: string, data: any): Promise<any> {
    const { data: updated } = await supabase
      .from('rewards')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    return updated;
  }

  async deleteReward(id: string): Promise<void> {
    await supabase.from('rewards').delete().eq('id', id);
  }
`;

  rewardsService = rewardsService.replace(
    /^}(\s+\/\/ Export singleton)/m,
    `${rewardsCRUD}\n}\n$1`
  );
  fs.writeFileSync(rewardsServicePath, rewardsService);
  console.log("✅ Added CRUD methods to rewards service");
} else {
  console.log("✅ Rewards service already has required methods");
}

// 7. Fix Subscriptions Controller - import SubscriptionService
console.log("7️⃣ Fixing subscriptions controller imports...");
const subsControllerPath = path.join(
  srcDir,
  "modules/subscriptions/subscriptions.controller.ts"
);
let subsController = fs.readFileSync(subsControllerPath, "utf8");

// Add import for SubscriptionService class
if (!subsController.includes("import { SubscriptionService }")) {
  subsController = subsController.replace(
    "import { subscriptionService }",
    "import { SubscriptionService, subscriptionService }"
  );
  fs.writeFileSync(subsControllerPath, subsController);
  console.log("✅ Fixed subscriptions controller imports");
}

// 8. Fix bills service enhancedAlertService import
console.log("8️⃣ Fixing bills service alert imports...");
const billsServiceFile = path.join(srcDir, "modules/bills/bills.service.ts");
let billsServiceContent = fs.readFileSync(billsServiceFile, "utf8");

// Check if import already exists
if (billsServiceContent.includes("enhancedAlertService.createAlert")) {
  // Ensure import is correct
  if (!billsServiceContent.includes("import { enhancedAlertService }")) {
    // Add the import after supabase import
    billsServiceContent = billsServiceContent.replace(
      'import { supabase } from "shared/database/supabase";',
      'import { supabase } from "shared/database/supabase";\nimport { EnhancedAlertService } from "../alerts/alerts.service";'
    );

    // Replace enhancedAlertService with EnhancedAlertService (static calls)
    billsServiceContent = billsServiceContent.replace(
      /enhancedAlertService\./g,
      "EnhancedAlertService."
    );

    fs.writeFileSync(billsServiceFile, billsServiceContent);
    console.log("✅ Fixed bills service alert imports");
  }
}

console.log("\n✅ Phase 2 complete!");
console.log("🔍 Run `npm run type-check` to verify fixes.\n");
