#!/usr/bin/env node
/**
 * deps-verify.js
 * Verifies all required dependencies are properly installed for api-gateway
 *
 * This script checks:
 * 1. Core dependencies exist (express, redis, etc.)
 * 2. Type definitions are installed (@types/node, @types/express)
 * 3. Build tooling is available (typescript, tsc-alias)
 * 4. Shared workspace dependencies are properly linked
 *
 * Fails with helpful messages if anything is missing.
 */

const fs = require("fs");
const path = require("path");

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`✗ ${message}`, "red");
}

function success(message) {
  log(`✓ ${message}`, "green");
}

function info(message) {
  log(`ℹ ${message}`, "blue");
}

function warning(message) {
  log(`⚠ ${message}`, "yellow");
}

// Read package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
if (!fs.existsSync(packageJsonPath)) {
  error("package.json not found!");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Define required dependencies
const requiredDeps = {
  dependencies: [
    { name: "express", reason: "Core web framework" },
    { name: "redis", reason: "Required by shared/monitoring modules" },
    { name: "typescript", reason: "TypeScript compiler for build" },
    { name: "tsc-alias", reason: "Path alias resolution after tsc" },
    { name: "@sentry/node", reason: "Error monitoring" },
    { name: "@supabase/supabase-js", reason: "Database client" },
  ],
  devDependencies: [
    { name: "@types/node", reason: "Node.js type definitions" },
    { name: "@types/express", reason: "Express type definitions" },
    { name: "ts-node", reason: "Development execution" },
  ],
};

let hasErrors = false;
let hasWarnings = false;

info("🔍 Verifying dependencies for api-gateway...\n");

// Check dependencies
log("Checking dependencies:", "blue");
for (const dep of requiredDeps.dependencies) {
  const exists = packageJson.dependencies && packageJson.dependencies[dep.name];
  if (exists) {
    success(`${dep.name} - ${dep.reason}`);
  } else {
    error(`${dep.name} is MISSING - ${dep.reason}`);
    info(`  Fix: npm install --save ${dep.name}`);
    hasErrors = true;
  }
}

console.log("");

// Check devDependencies
log("Checking devDependencies:", "blue");
for (const dep of requiredDeps.devDependencies) {
  const exists = packageJson.devDependencies && packageJson.devDependencies[dep.name];
  if (exists) {
    success(`${dep.name} - ${dep.reason}`);
  } else {
    error(`${dep.name} is MISSING - ${dep.reason}`);
    info(`  Fix: npm install --save-dev ${dep.name}`);
    hasErrors = true;
  }
}

console.log("");

// Check that node_modules exists
const nodeModulesPath = path.join(__dirname, "..", "node_modules");
if (!fs.existsSync(nodeModulesPath)) {
  error("node_modules directory not found!");
  info("  Fix: npm install");
  hasErrors = true;
} else {
  success("node_modules directory exists");

  // Verify critical modules are actually installed
  const criticalModules = ["express", "redis", "typescript", "tsc-alias"];
  for (const mod of criticalModules) {
    const modPath = path.join(nodeModulesPath, mod);
    if (!fs.existsSync(modPath)) {
      error(`Module ${mod} is listed in package.json but not installed`);
      info("  Fix: npm install");
      hasErrors = true;
    }
  }
}

console.log("");

// Check shared workspace link
log("Checking workspace dependencies:", "blue");
const sharedPath = path.join(__dirname, "..", "..", "..", "shared");
if (!fs.existsSync(sharedPath)) {
  error("Shared workspace not found at ../../shared");
  hasErrors = true;
} else {
  success("Shared workspace exists");

  // Check if shared has its own dependencies satisfied
  const sharedPackageJson = path.join(sharedPath, "package.json");
  if (fs.existsSync(sharedPackageJson)) {
    const sharedPkg = JSON.parse(fs.readFileSync(sharedPackageJson, "utf8"));

    // Check if shared needs redis (since monitoring uses it)
    const sharedNodeModules = path.join(sharedPath, "node_modules", "redis");
    if (!fs.existsSync(sharedNodeModules)) {
      warning("Redis not found in shared/node_modules - monitoring modules may fail");
      info("  The shared package imports redis but it may not be installed there");
      info("  Since api-gateway has redis, it should work via hoisting");
      hasWarnings = true;
    }
  }
}

console.log("");

// Check tsconfig exists
const tsconfigPath = path.join(__dirname, "..", "tsconfig.json");
if (!fs.existsSync(tsconfigPath)) {
  error("tsconfig.json not found!");
  hasErrors = true;
} else {
  success("tsconfig.json exists");

  // Verify tsconfig has required settings
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  if (!tsconfig.compilerOptions) {
    error("tsconfig.json missing compilerOptions");
    hasErrors = true;
  } else {
    if (!tsconfig.compilerOptions.outDir) {
      error("tsconfig.json missing outDir - build output location unknown");
      hasErrors = true;
    } else {
      success(`Build output directory: ${tsconfig.compilerOptions.outDir}`);
    }

    if (!tsconfig.compilerOptions.types || !tsconfig.compilerOptions.types.includes("node")) {
      warning('tsconfig.json types array should include "node"');
      hasWarnings = true;
    }
  }
}

console.log("");

// Summary
log("═".repeat(60), "blue");
if (hasErrors) {
  error("❌ Dependency verification FAILED");
  log("\n📋 To fix all issues, run:", "yellow");
  log("   cd backend/services/api-gateway && npm install", "yellow");
  process.exit(1);
} else if (hasWarnings) {
  warning("⚠️  Dependency verification passed with warnings");
  log("\n💡 Review warnings above and fix if needed", "yellow");
  process.exit(0);
} else {
  success("✅ All dependencies verified successfully!");
  process.exit(0);
}
