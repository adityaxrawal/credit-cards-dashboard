#!/usr/bin/env node

/**
 * Script to refactor all backend services to use AppError
 * Replaces throw new Error() with AppError factory methods
 */

const fs = require("fs");
const path = require("path");

const modulesPath = path.join(__dirname, "../src/modules");

// Mapping of error patterns to AppError methods
const errorPatterns = [
  {
    pattern: /throw new Error\(['"`](.+?)not found['"`]\)/gi,
    replacement: (match, resource) => `throw AppError.notFound('${resource.trim()}')`,
  },
  {
    pattern: /throw new Error\(['"`]Unauthorized.+?['"`]\)/gi,
    replacement: () => `throw AppError.unauthorized()`,
  },
  {
    pattern: /throw new Error\(['"`]Invalid.+?['"`]\)/gi,
    replacement: (match) => {
      const message = match.match(/['"`](.+?)['"`]/)[1];
      return `throw AppError.validation('${message}')`;
    },
  },
  {
    pattern: /throw new Error\(['"`]Failed to (?:fetch|query|get|retrieve).+?['"`]\)/gi,
    replacement: (match) => {
      const message = match.match(/['"`](.+?)['"`]/)[1];
      return `throw AppError.database('${message}')`;
    },
  },
  {
    pattern: /throw new Error\(['"`](.+?)['"`]\)/gi,
    replacement: (match, message) => {
      // Default fallback for generic errors
      if (message.toLowerCase().includes("database") || message.toLowerCase().includes("query")) {
        return `throw AppError.database('${message}')`;
      }
      if (
        message.toLowerCase().includes("validation") ||
        message.toLowerCase().includes("invalid")
      ) {
        return `throw AppError.validation('${message}')`;
      }
      if (
        message.toLowerCase().includes("not found") ||
        message.toLowerCase().includes("missing")
      ) {
        return `throw AppError.notFound('${message}')`;
      }
      return `throw AppError.internal('${message}')`;
    },
  },
];

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;

  // Check if AppError is already imported
  const hasAppErrorImport = content.includes("AppError");

  // Apply error pattern replacements
  errorPatterns.forEach(({ pattern, replacement }) => {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  // Add AppError import if modifications were made and import doesn't exist
  if (modified && !hasAppErrorImport) {
    const importStatement = `import { AppError } from "shared/errors/AppError";\n`;

    // Find the last import statement
    const importRegex = /^import .+ from .+;$/gm;
    const imports = content.match(importRegex);

    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      content = content.replace(lastImport, `${lastImport}\n${importStatement}`);
    } else {
      // No imports found, add at the top
      content = importStatement + content;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ Refactored: ${filePath}`);
    return true;
  }

  return false;
}

function walkDirectory(dir, fileCallback) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDirectory(filePath, fileCallback);
    } else if (stat.isFile() && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
      fileCallback(filePath);
    }
  });
}

function main() {
  console.log("🔄 Starting AppError refactoring...\n");

  let filesModified = 0;
  let filesScanned = 0;

  walkDirectory(modulesPath, (filePath) => {
    filesScanned++;
    if (refactorFile(filePath)) {
      filesModified++;
    }
  });

  console.log(`\n✅ Refactoring complete!`);
  console.log(`   Files scanned: ${filesScanned}`);
  console.log(`   Files modified: ${filesModified}`);
}

if (require.main === module) {
  main();
}

module.exports = { refactorFile, walkDirectory };
