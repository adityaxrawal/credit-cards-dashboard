#!/usr/bin/env node

/**
 * TODO to GitHub Issues Converter
 *
 * Parses all TypeScript/TSX files for TODO comments and creates GitHub issues.
 * Then removes the TODO comments from the source files.
 *
 * Usage:
 *   node scripts/convert-todos-to-issues.js
 *
 * Environment Variables:
 *   GITHUB_TOKEN - Personal access token with repo scope
 *   GITHUB_OWNER - Repository owner (e.g., "adityaxrawal")
 *   GITHUB_REPO - Repository name (e.g., "credit-cards-dashboard")
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "adityaxrawal";
const GITHUB_REPO = process.env.GITHUB_REPO || "credit-cards-dashboard";
const DRY_RUN = process.env.DRY_RUN === "true";

const TODO_PATTERN = /\/\/\s*TODO:?\s*(.+?)(?:\n|$)/gi;
const FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const EXCLUDE_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  "coverage",
  ".git",
];

/**
 * Find all source files
 */
function findSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name)) {
        findSourceFiles(fullPath, files);
      }
    } else if (FILE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract TODOs from a file
 */
function extractTodos(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const todos = [];
  let match;

  const lines = content.split("\n");
  TODO_PATTERN.lastIndex = 0;

  while ((match = TODO_PATTERN.exec(content)) !== null) {
    const todoText = match[1].trim();
    const lineNumber = content.substring(0, match.index).split("\n").length;

    // Get surrounding context (3 lines before and after)
    const contextStart = Math.max(0, lineNumber - 4);
    const contextEnd = Math.min(lines.length, lineNumber + 3);
    const context = lines.slice(contextStart, contextEnd).join("\n");

    todos.push({
      text: todoText,
      lineNumber,
      match: match[0],
      context,
    });
  }

  return todos;
}

/**
 * Create GitHub issue
 */
async function createGitHubIssue(title, body, labels = ["todo", "automated"]) {
  if (!GITHUB_TOKEN) {
    console.warn("⚠️  GITHUB_TOKEN not set. Skipping issue creation.");
    return null;
  }

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        labels,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `GitHub API error: ${response.status} - ${JSON.stringify(error)}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to create issue: ${error.message}`);
    return null;
  }
}

/**
 * Remove TODO comments from file
 */
function removeTodosFromFile(filePath, todos) {
  let content = fs.readFileSync(filePath, "utf-8");

  // Remove each TODO comment (in reverse order to preserve line numbers)
  for (const todo of todos.reverse()) {
    content = content.replace(todo.match, "");
  }

  // Remove empty lines left behind (but keep intentional spacing)
  content = content.replace(/\n\n\n+/g, "\n\n");

  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Main execution
 */
async function main() {
  console.log("🔍 Scanning for TODO comments...\n");

  const rootDir = process.cwd();
  const sourceFiles = findSourceFiles(rootDir);
  console.log(`📁 Found ${sourceFiles.length} source files to scan\n`);

  const allTodos = [];

  for (const filePath of sourceFiles) {
    const todos = extractTodos(filePath);
    if (todos.length > 0) {
      const relativePath = path.relative(rootDir, filePath);
      console.log(`📝 ${relativePath}: ${todos.length} TODO(s)`);

      for (const todo of todos) {
        allTodos.push({
          ...todo,
          filePath: relativePath,
          fullPath: filePath,
        });
      }
    }
  }

  console.log(`\n✅ Found ${allTodos.length} total TODOs\n`);

  if (allTodos.length === 0) {
    console.log("🎉 No TODOs found. All clean!");
    return;
  }

  if (DRY_RUN) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
    console.log("TODOs that would be converted:\n");
    allTodos.forEach((todo, i) => {
      console.log(
        `${i + 1}. [${todo.filePath}:${todo.lineNumber}] ${todo.text}`
      );
    });
    return;
  }

  console.log("🚀 Creating GitHub issues...\n");

  const createdIssues = [];
  const failedIssues = [];

  for (const [index, todo] of allTodos.entries()) {
    const issueTitle =
      todo.text.length > 80 ? `${todo.text.substring(0, 77)}...` : todo.text;

    const issueBody = `## TODO from Code

**File**: \`${todo.filePath}\`  
**Line**: ${todo.lineNumber}

### Description
${todo.text}

### Code Context
\`\`\`typescript
${todo.context}
\`\`\`

---
*This issue was automatically created from a TODO comment.*
`;

    console.log(
      `[${index + 1}/${allTodos.length}] Creating issue: ${issueTitle.substring(
        0,
        60
      )}...`
    );

    const issue = await createGitHubIssue(issueTitle, issueBody);

    if (issue) {
      createdIssues.push({ todo, issue });
      console.log(`   ✅ Created #${issue.number}: ${issue.html_url}`);
    } else {
      failedIssues.push(todo);
      console.log(`   ❌ Failed to create issue`);
    }

    // Rate limiting: wait 1 second between requests
    if (index < allTodos.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Created: ${createdIssues.length} issues`);
  console.log(`   ❌ Failed: ${failedIssues.length} issues\n`);

  if (createdIssues.length === 0) {
    console.log("⚠️  No issues were created. Exiting without removing TODOs.");
    return;
  }

  console.log("🧹 Removing TODO comments from source files...\n");

  // Group TODOs by file
  const todosByFile = {};
  for (const { todo } of createdIssues) {
    if (!todosByFile[todo.fullPath]) {
      todosByFile[todo.fullPath] = [];
    }
    todosByFile[todo.fullPath].push(todo);
  }

  // Remove TODOs from each file
  for (const [filePath, todos] of Object.entries(todosByFile)) {
    const relativePath = path.relative(rootDir, filePath);
    console.log(`   🗑️  ${relativePath}: Removing ${todos.length} TODO(s)`);
    removeTodosFromFile(filePath, todos);
  }

  console.log("\n✅ All done!");
  console.log(`\n📋 Created issues:`);
  createdIssues.forEach(({ issue }) => {
    console.log(`   - #${issue.number}: ${issue.html_url}`);
  });

  // Create summary file
  const summaryPath = path.join(rootDir, "TODO_CONVERSION_SUMMARY.md");
  const summary = `# TODO Conversion Summary

**Date**: ${new Date().toISOString()}  
**Total TODOs**: ${allTodos.length}  
**Created Issues**: ${createdIssues.length}  
**Failed**: ${failedIssues.length}

## Created Issues

${createdIssues
  .map(
    ({ todo, issue }) =>
      `- [#${issue.number}](${issue.html_url}) - ${todo.text} (\`${todo.filePath}:${todo.lineNumber}\`)`
  )
  .join("\n")}

${
  failedIssues.length > 0
    ? `\n## Failed Issues\n\n${failedIssues
        .map(
          (todo) => `- ${todo.text} (\`${todo.filePath}:${todo.lineNumber}\`)`
        )
        .join("\n")}`
    : ""
}
`;

  fs.writeFileSync(summaryPath, summary, "utf-8");
  console.log(`\n📄 Summary saved to: ${summaryPath}`);
}

// Run
main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
