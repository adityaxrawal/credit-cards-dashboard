#!/usr/bin/env node
/**
 * Fix unused variables and parameters in TypeScript files
 */

const fs = require("fs");
const path = require("path");

const fixes = [
  // Prefix unused parameters with underscore
  {
    file: "src/modules/ai-insights/ai-insights.service.ts",
    replacements: [
      {
        from: "private static async analyzeBudgetTrends(userId: string, transactions: any[]): Promise<any> {",
        to: "private static async analyzeBudgetTrends(userId: string, _transactions: any[]): Promise<any> {",
      },
      {
        from: "        const card = cards.find((c) => c.id === cardId);",
        to: "        // const card = cards.find((c) => c.id === cardId);",
      },
      {
        from: "    currentUsage: any,",
        to: "    _currentUsage: any,",
      },
      {
        from: "    categoryStats.forEach((stats, category) => {",
        to: "    categoryStats.forEach((stats, _category) => {",
      },
      {
        from: "  private static async generateSpendingInsights(transactions: any[]): Promise<FinancialInsight[]> {",
        to: "  private static async generateSpendingInsights(_transactions: any[]): Promise<FinancialInsight[]> {",
      },
      {
        from: "    userId: string,",
        to: "    _userId: string,",
        count: 2,
      },
      {
        from: "    transactions: any[]",
        to: "    _transactions: any[]",
        count: 2,
      },
    ],
  },
  {
    file: "src/modules/alerts/alerts.service.ts",
    replacements: [
      {
        from: "    alert: any",
        to: "    _alert: any",
      },
    ],
  },
  {
    file: "src/modules/analytics/analytics.controller.ts",
    replacements: [
      {
        from: "      logger.error(`Get all analytics failed: ${error.message}`);",
        to: '      logger.error(`Get all analytics failed: ${error instanceof Error ? error.message : String(error)}`);',
      },
    ],
  },
  {
    file: "src/modules/analytics/analytics.service.ts",
    replacements: [
      {
        from: "    userId: string,",
        to: "    _userId: string,",
      },
      {
        from: "    metric: string,",
        to: "    _metric: string,",
      },
      {
        from: "  private static calculateFrequency(dates: Date[], dateRange: { start: Date; end: Date }): string {",
        to: "  private static calculateFrequency(dates: Date[], _dateRange: { start: Date; end: Date }): string {",
      },
      {
        from: "  static async create(data: any): Promise<any> {",
        to: "  static async create(_data: any): Promise<any> {",
      },
      {
        from: "  static async update(id: string, data: any): Promise<any> {",
        to: "  static async update(_id: string, _data: any): Promise<any> {",
      },
      {
        from: "  static async delete(id: string): Promise<void> {",
        to: "  static async delete(_id: string): Promise<void> {",
      },
    ],
  },
  {
    file: "src/modules/bills/bills.service.ts",
    replacements: [
      {
        from: "  static calculateNextBillDate(cardId: string, billingCycleDay: number, lastBillDate?: Date): Date {",
        to: "  static calculateNextBillDate(_cardId: string, billingCycleDay: number, lastBillDate?: Date): Date {",
      },
    ],
  },
  {
    file: "src/modules/gmail/gmail.controller.ts",
    replacements: [
      {
        from: 'import { Request, Response } from "express";',
        to: 'import { Response } from "express";',
      },
      {
        from: "    const userId = req.userId!;",
        to: "    // const userId = req.userId!;",
      },
    ],
  },
  {
    file: "src/modules/gmail/gmail-client.ts",
    replacements: [
      {
        from: "  private async updateUserTokens(",
        to: "  // eslint-disable-next-line @typescript-eslint/no-unused-vars\n  private async updateUserTokens(",
      },
    ],
  },
  {
    file: "src/modules/gmail/utils/rate-limiter.ts",
    replacements: [
      {
        from: "  private _lastFailureTime: number = 0;",
        to: "  // private _lastFailureTime: number = 0;",
      },
    ],
  },
  {
    file: "src/modules/reports/reports.service.ts",
    replacements: [
      {
        from: "  private static async generateBudgetPerformance(config: ReportConfig): Promise<any> {",
        to: "  private static async generateBudgetPerformance(_config: ReportConfig): Promise<any> {",
      },
      {
        from: "  private static async generateMonthlyTrends(config: ReportConfig): Promise<any> {",
        to: "  private static async generateMonthlyTrends(_config: ReportConfig): Promise<any> {",
      },
      {
        from: "  private static async generateYearlySummary(config: ReportConfig): Promise<any> {",
        to: "  private static async generateYearlySummary(_config: ReportConfig): Promise<any> {",
      },
      {
        from: "  private static async generateCashflowAnalysis(config: ReportConfig): Promise<any> {",
        to: "  private static async generateCashflowAnalysis(_config: ReportConfig): Promise<any> {",
      },
      {
        from: "  private static async generateMerchantAnalysis(config: ReportConfig): Promise<any> {",
        to: "  private static async generateMerchantAnalysis(_config: ReportConfig): Promise<any> {",
      },
      {
        from: "    data: any,",
        to: "    _data: any,",
        count: 2,
      },
      {
        from: "      const mockExcelData = this.generateMockExcelContent(data, config);",
        to: "      // const mockExcelData = this.generateMockExcelContent(data, config);",
      },
      {
        from: "  private static generateMockExcelContent(data: any, config: ReportConfig): string {",
        to: "  private static generateMockExcelContent(_data: any, config: ReportConfig): string {",
      },
      {
        from: "  static async update(id: string, updateData: any): Promise<any> {",
        to: "  static async update(id: string, _updateData: any): Promise<any> {",
      },
    ],
  },
  {
    file: "src/modules/rewards/rewards.service.ts",
    replacements: [
      {
        from: "      const marketCards = await this.getMarketCards();",
        to: "      // const marketCards = await this.getMarketCards();",
      },
      {
        from: "    merchantName?: string",
        to: "    _merchantName?: string",
      },
      {
        from: "    const { data: cards, error } = await supabase",
        to: "    const { data: cards } = await supabase",
      },
      {
        from: "    userId: string,",
        to: "    _userId: string,",
        count: 2,
      },
      {
        from: "    cardPortfolio: any[]",
        to: "    _cardPortfolio: any[]",
        count: 2,
      },
      {
        from: "    cards: any[]",
        to: "    _cards: any[]",
      },
    ],
  },
  {
    file: "src/modules/subscriptions/subscriptions.service.ts",
    replacements: [
      {
        from: "      const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);",
        to: "      // const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);",
      },
      {
        from: "    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;",
        to: "    // const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;",
      },
    ],
  },
  {
    file: "src/modules/transactions/transactions.controller.ts",
    replacements: [
      {
        from: 'import { Request, Response } from "express";',
        to: 'import { Response } from "express";',
      },
    ],
  },
  {
    file: "src/modules/transactions/transactions.service.ts",
    replacements: [
      {
        from: "interface Transaction {",
        to: "// interface Transaction {",
      },
    ],
  },
  {
    file: "src/routes/monitoring.ts",
    replacements: [
      {
        from: 'router.get("/health", async (req, res) => {',
        to: 'router.get("/health", async (_req, res) => {',
      },
      {
        from: 'router.get("/metrics", authenticate, async (req: AuthRequest, res) => {',
        to: 'router.get("/metrics", authenticate, async (req: AuthRequest, res): Promise<void> => {',
      },
      {
        from: 'router.get("/status", async (req, res) => {',
        to: 'router.get("/status", async (_req, res) => {',
      },
      {
        from: 'router.get("/readiness", async (req, res) => {',
        to: 'router.get("/readiness", async (_req, res): Promise<void> => {',
      },
      {
        from: 'router.get("/liveness", (req, res) => {',
        to: 'router.get("/liveness", (_req, res) => {',
      },
    ],
  },
];

const apiGatewayDir = path.join(__dirname, "..");

console.log("🔧 Fixing unused variables and parameters...\n");

let fixCount = 0;

for (const fix of fixes) {
  const filePath = path.join(apiGatewayDir, fix.file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fix.file}`);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  for (const replacement of fix.replacements) {
    const count = replacement.count || 1;
    let replaced = 0;

    for (let i = 0; i < count; i++) {
      if (content.includes(replacement.from)) {
        content = content.replace(replacement.from, replacement.to);
        replaced++;
        modified = true;
      }
    }

    if (replaced > 0) {
      fixCount += replaced;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Fixed ${fix.file}`);
  }
}

console.log(`\n✨ Applied ${fixCount} fixes!\n`);
