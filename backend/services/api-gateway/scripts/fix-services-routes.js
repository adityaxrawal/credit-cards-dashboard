#!/usr/bin/env node
/**
 * Fix services.routes.ts logger errors properly
 */

const fs = require("fs");
const path = require("path");

const apiGatewayDir = path.join(__dirname, "..");

console.log("🔧 Fixing services.routes.ts logger errors...\n");

const servicesRoutesPath = path.join(apiGatewayDir, "src/routes/services.routes.ts");
let content = fs.readFileSync(servicesRoutesPath, "utf8");

// Fix import first
content = content.replace(
  'import { logger } from "../utils/logger";',
  'import { logger } from "shared/monitoring/logger";'
);

// Fix error destructuring - keep 'error' as the property name, just handle it better
// Pattern 1: const { data: X, error: Y } = await supabase...
// We need to keep the destructuring but add proper type handling after

// Fix all logger.error calls with { error: variable }
content = content.replace(
  /logger\.error\("([^"]+)",\s*\{\s*error:\s*(\w+)(,\s*([^}]+))?\s*\}\);/g,
  (match, message, errorVar, _, otherProps) => {
    if (otherProps) {
      return `logger.error("${message}", { error: ${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar}), ${otherProps} });`;
    }
    return `logger.error("${message}", { error: ${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar}) });`;
  }
);

// Fix catch block logger calls
content = content.replace(
  /logger\.error\("([^"]+)",\s*\{\s*error\s*\}\);/g,
  'logger.error("$1", error as Error);'
);

fs.writeFileSync(servicesRoutesPath, content, "utf8");
console.log("✅ Fixed services.routes.ts\n");
