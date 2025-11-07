#!/usr/bin/env node
/**
 * Fix all remaining TypeScript errors for deployment
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const apiGatewayDir = path.join(__dirname, "..");

console.log("🔧 Fixing remaining TypeScript errors...\n");

//Fix logger imports - replace ../../utils/logger with shared/monitoring/logger
const filesToFixLogger = [
  "src/modules/ai-insights/ai-insights.controller.ts",
  "src/modules/alerts/alerts.controller.ts",
  "src/modules/analytics/analytics.controller.ts",
  "src/modules/bills/bills.controller.ts",
  "src/modules/budgets/budgets.controller.ts",
  "src/modules/reports/reports.controller.ts",
  "src/modules/rewards/rewards.controller.ts",
  "src/modules/gmail/email-fetcher.ts",
  "src/modules/gmail/gmail-client.ts",
  "src/modules/gmail/token-manager.ts",
];

for (const file of filesToFixLogger) {
  const filePath = path.join(apiGatewayDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");
    content = content.replace(
      /import \{ logger \} from ["']\.\.\/\.\.\/utils\/logger["']/g,
      'import { logger } from "shared/monitoring/logger"'
    );
    content = content.replace(
      /import \{ logger \} from ["']\.\.\/\.\.\/\.\.\/utils\/logger["']/g,
      'import { logger } from "shared/monitoring/logger"'
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Fixed logger import in ${file}`);
  }
}

// Fix monitoring.ts return type issues
const monitoringPath = path.join(apiGatewayDir, "src/routes/monitoring.ts");
let monitoringContent = fs.readFileSync(monitoringPath, "utf8");
monitoringContent = monitoringContent.replace(
  'router.get("/metrics", authenticate, async (req: AuthRequest, res): Promise<void> => {',
  'router.get("/metrics", authenticate, async (req: AuthRequest, res) => {'
);
monitoringContent = monitoringContent.replace(
  'router.get("/readiness", async (_req, res): Promise<void> => {',
  'router.get("/readiness", async (_req, res) => {'
);
fs.writeFileSync(monitoringPath, monitoringContent, "utf8");
console.log("✅ Fixed monitoring.ts");

// Fix services.routes.ts error property issues
const servicesRoutesPath = path.join(apiGatewayDir, "src/routes/services.routes.ts");
let servicesContent = fs.readFileSync(servicesRoutesPath, "utf8");
// Simply remove the { error: X } part from logger calls and pass the error directly
servicesContent = servicesContent.replace(
  /logger\.error\("([^"]+)",\s*\{\s*error:\s*(\w+)(\s*instanceof\s*Error\s*\?\s*\2\.message\s*:\s*String\(\2\))?,\s*([^}]+)\s*\}\);/g,
  'logger.error("$1", $2 as Error);'
);
fs.writeFileSync(servicesRoutesPath, servicesContent, "utf8");
console.log("✅ Fixed services.routes.ts");

console.log("\n✨ All fixes applied!\n");
