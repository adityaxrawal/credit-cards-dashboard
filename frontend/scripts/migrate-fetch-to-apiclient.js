#!/usr/bin/env node
/**
 * Script to migrate fetch() calls to apiClient
 * Focuses on component and page files, not infrastructure
 */

const fs = require("fs");
const path = require("path");

// Files to migrate (excluding api infrastructure)
const filesToMigrate = [
  "src/lib/api/settings.ts",
  "src/lib/auth/AuthContext.tsx",
  "src/app/(dashboard)/reports/page.tsx",
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/rewards/page.tsx",
  "src/components/feedback/FeedbackWidget.tsx",
  "src/components/dashboard/RemindersWidget.tsx",
  "src/components/gmail/HistoricalScanProgress.tsx",
  "src/components/gmail/ManualReviewQueue.tsx",
  "src/components/transactions/RecurringTransactionsList.tsx",
  "src/components/layout/NotificationBell.tsx",
  "src/components/settings/GmailIntegrationCard.tsx",
];

let totalMigrated = 0;
let filesModified = 0;

filesToMigrate.forEach((relPath) => {
  const filePath = path.join(__dirname, "..", relPath);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${relPath}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  const originalContent = content;
  let fileModified = false;

  // Check if apiClient is already imported
  const hasApiClientImport =
    content.includes("from '@/lib/api-client'") ||
    content.includes('from "../lib/api-client"') ||
    content.includes('from "../../lib/api-client"') ||
    content.includes('from "../../../lib/api-client"');

  // Pattern 1: GET requests - await fetch(url, { method: "GET", headers, credentials })
  const getPattern =
    /await fetch\(\s*`([^`]+)`\s*,\s*\{[^}]*method:\s*["']GET["'][^}]*\}\s*\)/g;
  let matches = content.match(getPattern);
  if (matches) {
    matches.forEach((match) => {
      const urlMatch = match.match(/`([^`]+)`/);
      if (urlMatch) {
        const url = urlMatch[1];
        // Extract the API path (remove ${...} for now)
        const apiPath = url.replace(/\$\{[^}]+\}/g, "${...}");
        const replacement = `await apiClient.get(\`${url}\`)`;
        content = content.replace(match, replacement);
        totalMigrated++;
        fileModified = true;
      }
    });
  }

  // Pattern 2: Simple GET - await fetch(url)
  const simpleGetPattern = /await fetch\(\s*`([^`]+)`\s*\)/g;
  matches = content.match(simpleGetPattern);
  if (matches) {
    matches.forEach((match) => {
      const urlMatch = match.match(/`([^`]+)`/);
      if (urlMatch) {
        const url = urlMatch[1];
        const replacement = `await apiClient.get(\`${url}\`)`;
        content = content.replace(match, replacement);
        totalMigrated++;
        fileModified = true;
      }
    });
  }

  // Pattern 3: POST requests
  const postPattern =
    /await fetch\(\s*`([^`]+)`\s*,\s*\{[^}]*method:\s*["']POST["'][^}]*body:\s*JSON\.stringify\(([^)]+)\)[^}]*\}\s*\)/g;
  matches = content.match(postPattern);
  if (matches) {
    matches.forEach((match) => {
      const urlMatch = match.match(/`([^`]+)`/);
      const bodyMatch = match.match(/JSON\.stringify\(([^)]+)\)/);
      if (urlMatch && bodyMatch) {
        const url = urlMatch[1];
        const body = bodyMatch[1];
        const replacement = `await apiClient.post(\`${url}\`, ${body})`;
        content = content.replace(match, replacement);
        totalMigrated++;
        fileModified = true;
      }
    });
  }

  // Pattern 4: PUT requests
  const putPattern =
    /await fetch\(\s*`([^`]+)`\s*,\s*\{[^}]*method:\s*["']PUT["'][^}]*body:\s*JSON\.stringify\(([^)]+)\)[^}]*\}\s*\)/g;
  matches = content.match(putPattern);
  if (matches) {
    matches.forEach((match) => {
      const urlMatch = match.match(/`([^`]+)`/);
      const bodyMatch = match.match(/JSON\.stringify\(([^)]+)\)/);
      if (urlMatch && bodyMatch) {
        const url = urlMatch[1];
        const body = bodyMatch[1];
        const replacement = `await apiClient.put(\`${url}\`, ${body})`;
        content = content.replace(match, replacement);
        totalMigrated++;
        fileModified = true;
      }
    });
  }

  // Pattern 5: DELETE requests
  const deletePattern =
    /await fetch\(\s*`([^`]+)`\s*,\s*\{[^}]*method:\s*["']DELETE["'][^}]*\}\s*\)/g;
  matches = content.match(deletePattern);
  if (matches) {
    matches.forEach((match) => {
      const urlMatch = match.match(/`([^`]+)`/);
      if (urlMatch) {
        const url = urlMatch[1];
        const replacement = `await apiClient.delete(\`${url}\`)`;
        content = content.replace(match, replacement);
        totalMigrated++;
        fileModified = true;
      }
    });
  }

  // Add import if needed and file was modified
  if (fileModified && !hasApiClientImport) {
    // Determine correct import path based on file location
    const depth = (relPath.match(/\//g) || []).length - 1;
    const importPath = "../".repeat(depth) + "lib/api-client";

    // Add import after other imports
    const importStatement = `import { apiClient } from '@/lib/api-client';\n`;

    // Find the last import statement
    const importLines = content.split("\n");
    let lastImportIndex = -1;
    importLines.forEach((line, index) => {
      if (line.trim().startsWith("import ")) {
        lastImportIndex = index;
      }
    });

    if (lastImportIndex >= 0) {
      importLines.splice(lastImportIndex + 1, 0, importStatement.trim());
      content = importLines.join("\n");
    }
  }

  if (fileModified) {
    fs.writeFileSync(filePath, content);
    filesModified++;
    console.log(`✅ Migrated: ${relPath}`);
  } else {
    console.log(`⏭️  Skipped: ${relPath} (no changes needed)`);
  }
});

console.log(`\n📊 Migration Summary:`);
console.log(`   Files Modified: ${filesModified}`);
console.log(`   Total fetch() calls migrated: ${totalMigrated}`);
console.log(`\n⚠️  Note: Please manually review and test the migrated files!`);
