#!/usr/bin/env node

/**
 * Export service instances from each module
 */

const fs = require("fs");
const path = require("path");

const MODULES_DIR = path.join(__dirname, "../src/modules");

const modules = [
  "cards",
  "transactions",
  "budgets",
  "alerts",
  "analytics",
  "bills",
  "subscriptions",
  "rewards",
  "ai-insights",
  "reports",
  "auth",
];

modules.forEach((moduleName) => {
  const servicePath = path.join(
    MODULES_DIR,
    moduleName,
    `${moduleName}.service.ts`
  );

  if (!fs.existsSync(servicePath)) {
    console.log(`⚠️  Service not found: ${servicePath}`);
    return;
  }

  let content = fs.readFileSync(servicePath, "utf8");

  // Check if already exports instance
  if (content.includes("export const") && content.includes("Service = new")) {
    console.log(`✅ ${moduleName} already exports instance`);
    return;
  }

  // Get service class name
  const match = content.match(/export class (\w+Service)/);
  if (!match) {
    console.log(`⚠️  Could not find service class in ${moduleName}`);
    return;
  }

  const className = match[1];
  const instanceName = className.charAt(0).toLowerCase() + className.slice(1);

  // Append instance export at the end
  const instanceExport = `\n\n// Export singleton instance\nexport const ${instanceName} = new ${className}();\n`;
  content += instanceExport;

  fs.writeFileSync(servicePath, content);
  console.log(`✅ Added instance export to ${moduleName}: ${instanceName}`);
});

console.log("\n🎉 Service instances created!");
