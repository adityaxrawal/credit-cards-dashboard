#!/usr/bin/env node

/**
 * Comprehensive script to refactor all services to use AppError
 * Handles multiple error patterns and edge cases
 */

const fs = require("fs");
const path = require("path");

const modulesPath = path.join(__dirname, "../src/modules");

// Statistics
let stats = {
  filesProcessed: 0,
  filesModified: 0,
  errorsReplaced: 0,
  importsAdded: 0,
};

// Error mapping patterns
const errorMappings = [
  // Not found errors
  { pattern: /throw new Error\(['"`](.+?)\s+not found['"`]\)/gi, type: "notFound", extract: 1 },
  { pattern: /throw new Error\(['"`]Card not found['"`]\)/gi, type: "notFound", resource: "Card" },
  { pattern: /throw new Error\(['"`]User not found['"`]\)/gi, type: "notFound", resource: "User" },
  {
    pattern: /throw new Error\(['"`]Transaction not found['"`]\)/gi,
    type: "notFound",
    resource: "Transaction",
  },
  {
    pattern: /throw new Error\(['"`]Budget not found['"`]\)/gi,
    type: "notFound",
    resource: "Budget",
  },

  // Unauthorized/Auth errors
  { pattern: /throw new Error\(ERROR_MESSAGES\.AUTH\.UNAUTHORIZED\)/gi, type: "unauthorized" },
  { pattern: /throw new Error\(['"`]Unauthorized.+?['"`]\)/gi, type: "unauthorized" },
  {
    pattern: /throw new Error\(['"`]Invalid token['"`]\)/gi,
    type: "unauthorized",
    message: "Invalid or expired token",
  },
  {
    pattern: /throw new Error\(ERROR_MESSAGES\.AUTH\.TOKEN_INVALID\)/gi,
    type: "unauthorized",
    message: "Invalid token",
  },

  // Validation errors
  { pattern: /throw new Error\(['"`]Invalid.+?['"`]\)/gi, type: "validation" },
  { pattern: /throw new Error\(ERROR_MESSAGES\.VALIDATION\..+?\)/gi, type: "validation" },

  // Database errors
  {
    pattern:
      /throw new Error\(['"`]Failed to (?:fetch|query|get|retrieve|create|update|delete).+?['"`]\)/gi,
    type: "database",
  },
  {
    pattern: /throw new Error\(ERROR_MESSAGES\.GENERIC\.DATABASE_ERROR\)/gi,
    type: "database",
    message: "Database operation failed",
  },

  // Gmail/External service errors
  {
    pattern:
      /throw new Error\(['"`]Failed to (?:exchange|fetch|disconnect|store|refresh).+?Gmail.+?['"`]\)/gi,
    type: "externalService",
    service: "Gmail",
  },
  {
    pattern: /throw new Error\(['"`]No tokens found.+?['"`]\)/gi,
    type: "externalService",
    service: "Gmail",
    message: "No tokens found for user",
  },

  // Generic internal errors
  {
    pattern: /throw new Error\(ERROR_MESSAGES\.GENERIC\.INTERNAL_ERROR\)/gi,
    type: "internal",
    message: "Internal server error",
  },
];

function extractMessage(match) {
  const messageMatch = match.match(/['"`](.+?)['"`]/);
  return messageMatch ? messageMatch[1] : "An error occurred";
}

function convertToAppError(errorThrow) {
  const original = errorThrow;

  // Try each pattern
  for (const mapping of errorMappings) {
    if (mapping.pattern.test(errorThrow)) {
      const message = mapping.message || extractMessage(errorThrow);

      switch (mapping.type) {
        case "notFound":
          const resource =
            mapping.resource ||
            (mapping.extract ? extractMessage(errorThrow).replace(" not found", "") : "Resource");
          return `throw AppError.notFound("${resource}")`;

        case "unauthorized":
          return `throw AppError.unauthorized("${message}")`;

        case "validation":
          return `throw AppError.validation("${message}")`;

        case "database":
          return `throw AppError.database("${message}", { error })`;

        case "externalService":
          return `throw AppError.externalService("${mapping.service}", "${message}", { error })`;

        case "internal":
          return `throw AppError.internal("${message}")`;
      }
    }
  }

  // Fallback: convert to internal error
  const message = extractMessage(original);
  return `throw AppError.internal("${message}", { originalError: error })`;
}

function processFile(filePath) {
  stats.filesProcessed++;

  let content = fs.readFileSync(filePath, "utf8");
  const originalContent = content;

  // Check if already has AppError import
  const hasAppErrorImport = /import.*AppError.*from.*shared\/errors\/AppError/.test(content);

  // Find and replace all throw new Error statements
  let errorsInFile = 0;
  const throwPattern = /throw new Error\([^)]+\)/g;
  const matches = content.match(throwPattern);

  if (matches) {
    matches.forEach((match) => {
      const replacement = convertToAppError(match);
      content = content.replace(match, replacement);
      errorsInFile++;
      stats.errorsReplaced++;
    });
  }

  // Add AppError import if needed
  if (errorsInFile > 0 && !hasAppErrorImport) {
    // Find last import statement
    const importLines = content.split("\n");
    let lastImportIndex = -1;

    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].trim().startsWith("import ") && importLines[i].includes("from ")) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex !== -1) {
      importLines.splice(
        lastImportIndex + 1,
        0,
        'import { AppError } from "shared/errors/AppError";'
      );
      content = importLines.join("\n");
      stats.importsAdded++;
    }
  }

  // Only write if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, "utf8");
    stats.filesModified++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}: ${errorsInFile} errors converted`);
    return true;
  }

  return false;
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath);
    } else if (file.endsWith(".ts") && !file.endsWith(".spec.ts") && !file.endsWith(".test.ts")) {
      processFile(filePath);
    }
  });
}

console.log("🔄 Starting comprehensive AppError refactoring...\n");

walkDirectory(modulesPath);

console.log("\n" + "=".repeat(60));
console.log("📊 Refactoring Complete!");
console.log("=".repeat(60));
console.log(`Files Processed:  ${stats.filesProcessed}`);
console.log(`Files Modified:   ${stats.filesModified}`);
console.log(`Errors Replaced:  ${stats.errorsReplaced}`);
console.log(`Imports Added:    ${stats.importsAdded}`);
console.log("=".repeat(60));
