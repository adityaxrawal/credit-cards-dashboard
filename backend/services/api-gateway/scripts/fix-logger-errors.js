#!/usr/bin/env node
/**
 * Fix remaining logger error issues
 */

const fs = require("fs");
const path = require("path");

const apiGatewayDir = path.join(__dirname, "..");

console.log("🔧 Fixing remaining logger errors...\n");

// Files with logger.error({ error }) issues
const filesToFix = [
  "src/modules/ai-insights/ai-insights.controller.ts",
  "src/modules/gmail/email-fetcher.ts",
  "src/modules/gmail/gmail-client.ts",
  "src/modules/gmail/token-manager.ts",
];

for (const file of filesToFix) {
  const filePath = path.join(apiGatewayDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");
    // Replace logger.error("message", { error }) with logger.error("message", error as Error)
    content = content.replace(
      /logger\.error\("([^"]+)",\s*\{\s*error\s*\}\);/g,
      'logger.error("$1", error as Error);'
    );
    // Replace logger.error("message", { error, otherProp }) with logger.error("message", error as Error)
    content = content.replace(
      /logger\.error\("([^"]+)",\s*\{\s*error,\s*([^}]+)\}\);/g,
      'logger.error("$1", error as Error);'
    );
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✅ Fixed ${file}`);
  }
}

// Fix monitoring.ts return type issues
const monitoringPath = path.join(apiGatewayDir, "src/routes/monitoring.ts");
let monitoringContent = fs.readFileSync(monitoringPath, "utf8");

// Find and fix the metrics route - need to ensure all paths return
const metricsMatch = monitoringContent.match(
  /router\.get\("\/metrics", authenticate, async \(req: AuthRequest, res\) => \{[\s\S]*?\n\}\);/
);
if (metricsMatch) {
  const metricsRoute = metricsMatch[0];
  // Check if the last line before }); has a return
  if (!metricsRoute.includes("return res.json")) {
    // Add return to the last res.json call
    const fixed = metricsRoute.replace(
      /(\s+)res\.json\(\{[\s\S]*?\}\);(\s+)\}\);$/,
      "$1return res.json({$&"
    );
    monitoringContent = monitoringContent.replace(metricsRoute, fixed);
  }
}

// Simpler fix: just ensure the success path has return
monitoringContent = monitoringContent.replace(
  /(router\.get\("\/metrics"[\s\S]*?res\.json\(\{\s*status:\s*"success")/g,
  (match) => {
    if (!match.includes("return res.json")) {
      return match.replace("res.json({", "return res.json({");
    }
    return match;
  }
);

monitoringContent = monitoringContent.replace(
  /(router\.get\("\/readiness"[\s\S]*?res\.status\(200\)\.json\(\{[\s\S]*?\}\);)/g,
  (match) => {
    if (!match.includes("return res.status")) {
      return match.replace("res.status(200)", "return res.status(200)");
    }
    return match;
  }
);

fs.writeFileSync(monitoringPath, monitoringContent, "utf8");
console.log("✅ Fixed monitoring.ts");

console.log("\n✨ All fixes applied!\n");
