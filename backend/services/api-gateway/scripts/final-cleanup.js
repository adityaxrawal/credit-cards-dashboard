#!/usr/bin/env node

/**
 * Phase 4: Final cleanup - remove duplicates and fix signatures
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Phase 4: Final cleanup...\n');

const srcDir = path.join(__dirname, '../src');

// 1. Remove duplicate CRUD methods in bills.service.ts
console.log('1️⃣ Removing duplicate methods in bills.service.ts...');
const billsServicePath = path.join(srcDir, 'modules/bills/bills.service.ts');
let billsService = fs.readFileSync(billsServicePath, 'utf8');

// Keep only the first occurrence of CRUD methods (they appear after line 700, and duplicates at end)
// Find and remove the duplicate CRUD methods section at the end
const crudSectionRegex = /\/\*\*\s+\* CRUD Wrapper Methods for API Controller[\s\S]*?static async deleteBill\(id: string\): Promise<void> \{[\s\S]*?\}/;
const matches = billsService.match(new RegExp(crudSectionRegex, 'g'));

if (matches && matches.length > 1) {
  // Keep first, remove second
  const firstIndex = billsService.indexOf(matches[0]);
  const secondIndex = billsService.indexOf(matches[1], firstIndex + matches[0].length);
  
  billsService = billsService.substring(0, secondIndex) + billsService.substring(secondIndex + matches[1].length);
}

// Fix createBillReminder call in createBill
billsService = billsService.replace(
  /static async createBill\(data: any\): Promise<any> \{\s+return await this\.createBillReminder\(data\);/g,
  `static async createBill(data: any): Promise<any> {
    return await this.createBillReminder(data.userId, data);`
);

fs.writeFileSync(billsServicePath, billsService);
console.log('✅ Fixed bills.service.ts');

// 2. Fix reports.service.ts duplicates
console.log('2️⃣ Removing duplicate methods in reports.service.ts...');
const reportsServicePath = path.join(srcDir, 'modules/reports/reports.service.ts');
let reportsService = fs.readFileSync(reportsServicePath, 'utf8');

// Similar approach for reports
const reportsCrudRegex = /\/\*\*\s+\* CRUD Wrapper Methods for API Controller[\s\S]*?static async delete\(id: string\): Promise<void> \{[\s\S]*?\}/;
const reportsMatches = reportsService.match(new RegExp(reportsCrudRegex, 'g'));

if (reportsMatches && reportsMatches.length > 1) {
  const firstIndex = reportsService.indexOf(reportsMatches[0]);
  const secondIndex = reportsService.indexOf(reportsMatches[1], firstIndex + reportsMatches[0].length);
  
  reportsService = reportsService.substring(0, secondIndex) + reportsService.substring(secondIndex + reportsMatches[1].length);
}

// Fix method calls in reports
reportsService = reportsService.replace(
  /return await this\.generateReport\(data\.userId, data\.type, data\);/g,
  'return await this.generateMonthlyReport(data.userId, new Date().getMonth() + 1, new Date().getFullYear());'
);

reportsService = reportsService.replace(
  /return await this\.getReportHistory\(userId, 50\);/g,
  'const { data } = await supabase.from("reports").select("*").eq("user_id", userId).limit(50).order("created_at", { ascending: false }); return data || [];'
);

fs.writeFileSync(reportsServicePath, reportsService);
console.log('✅ Fixed reports.service.ts');

// 3. Fix rewards.service.ts method calls
console.log('3️⃣ Fixing rewards.service.ts method implementations...');
const rewardsServicePath = path.join(srcDir, 'modules/rewards/rewards.service.ts');
let rewardsService = fs.readFileSync(rewardsServicePath, 'utf8');

rewardsService = rewardsService.replace(
  /return await RewardsService\.trackCardReward\(data\.cardId, data\.transactionId, data\);/g,
  'const { data: reward } = await supabase.from("rewards").insert(data).select().single(); return reward;'
);

rewardsService = rewardsService.replace(
  /return await RewardsService\.getRewardsHistory\(userId, \{\}\);/g,
  'const { data } = await supabase.from("rewards").select("*").eq("user_id", userId).order("earned_date", { ascending: false }); return data || [];'
);

fs.writeFileSync(rewardsServicePath, rewardsService);
console.log('✅ Fixed rewards.service.ts');

// 4. Fix subscriptions controller method signatures
console.log('4️⃣ Fixing subscriptions controller...');
const subsControllerPath = path.join(srcDir, 'modules/subscriptions/subscriptions.controller.ts');
let subsController = fs.readFileSync(subsControllerPath, 'utf8');

// Fix addSubscription call
subsController = subsController.replace(
  /const result = await SubscriptionService\.addSubscription\(req\.body\);/g,
  'const userId = (req as any).user?.userId;\n      const result = await SubscriptionService.trackSubscription(userId, req.body);'
);

// Fix getSubscriptionById call
subsController = subsController.replace(
  /const result = await SubscriptionService\.getSubscriptionById\(id\);/g,
  'const userId = (req as any).user?.userId;\n      const { data: result } = await supabase.from("subscriptions").select("*").eq("id", id).eq("user_id", userId).single();'
);

// Fix updateSubscriptionStatus call
subsController = subsController.replace(
  /const result = await SubscriptionService\.updateSubscriptionStatus\(id, req\.body\);/g,
  'const userId = (req as any).user?.userId;\n      const result = await SubscriptionService.updateSubscriptionStatus(id, userId, req.body.status);'
);

// Fix cancelSubscription call
subsController = subsController.replace(
  /await SubscriptionService\.cancelSubscription\(id\);/g,
  'const userId = (req as any).user?.userId;\n      await SubscriptionService.cancelSubscription(id, userId);'
);

// Add supabase import if needed
if (subsController.includes('supabase.from') && !subsController.includes('import { supabase }')) {
  subsController = subsController.replace(
    'import { Request, Response',
    'import { supabase } from "shared/database/supabase";\nimport { Request, Response'
  );
}

fs.writeFileSync(subsControllerPath, subsController);
console.log('✅ Fixed subscriptions controller');

// 5. Fix analytics service getDetailedAnalytics
console.log('5️⃣ Fixing analytics service method reference...');
const analyticsServicePath = path.join(srcDir, 'modules/analytics/analytics.service.ts');
let analyticsService = fs.readFileSync(analyticsServicePath, 'utf8');

analyticsService = analyticsService.replace(
  /return await AdvancedAnalyticsService\.getDetailedAnalytics\(/g,
  'return await AdvancedAnalyticsService.getSpendingAnalytics('
);

fs.writeFileSync(analyticsServicePath, analyticsService);
console.log('✅ Fixed analytics service');

// 6. Fix budgets service createCategoryBudget signature
console.log('6️⃣ Fixing budgets service createBudget call...');
const budgetsServicePath = path.join(srcDir, 'modules/budgets/budgets.service.ts');
let budgetsService = fs.readFileSync(budgetsServicePath, 'utf8');

budgetsService = budgetsService.replace(
  /static async createBudget\(data: any\): Promise<any> \{\s+return await this\.createCategoryBudget\(data\.userId, data\);/g,
  `static async createBudget(data: any): Promise<any> {
    return await this.createCategoryBudget(
      data.userId,
      data.category,
      data.amount,
      data.period || 'monthly',
      data.startDate ? new Date(data.startDate) : new Date(),
      data.endDate ? new Date(data.endDate) : undefined
    );`
);

fs.writeFileSync(budgetsServicePath, budgetsService);
console.log('✅ Fixed budgets service');

// 7. Fix alerts service createAlertFromTemplate signature
console.log('7️⃣ Fixing alerts service createAlert implementation...');
const alertsServicePath = path.join(srcDir, 'modules/alerts/alerts.service.ts');
let alertsService = fs.readFileSync(alertsServicePath, 'utf8');

alertsService = alertsService.replace(
  /static async createAlert\(data: any\): Promise<any> \{[\s\S]*?return await this\.createAlertFromTemplate\([\s\S]*?\);/,
  `static async createAlert(data: any): Promise<any> {
    return await this.createAlertFromTemplate(
      data.userId,
      data.type || 'budget_exceeded',
      data.title || 'Alert',
      data.message || ''
    );`
);

fs.writeFileSync(alertsServicePath, alertsService);
console.log('✅ Fixed alerts service');

console.log('\n✅ Phase 4 complete!');
console.log('🔍 Run `npm run type-check` one final time.\n');
