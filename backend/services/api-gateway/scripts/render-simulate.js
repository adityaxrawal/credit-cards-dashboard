#!/usr/bin/env node
/**
 * render-simulate.js
 * Simulates the exact Render.com build process for api-gateway
 *
 * This script replicates what Render does:
 * 1. Clean install dependencies (npm ci or npm install)
 * 2. Run build command (npm run build)
 * 3. Verify dist/index.js exists and is valid
 * 4. Verify all path aliases are resolved
 *
 * Use this locally to catch build issues before pushing to Render.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
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

function step(message) {
  log(`\n▶ ${message}`, "cyan");
  log("─".repeat(60), "cyan");
}

// Configuration - updated for single package.json structure
const BACKEND_ROOT = path.join(__dirname, "..", "..", "..");
const API_GATEWAY_DIR = path.join(__dirname, "..");
const DIST_DIR = path.join(API_GATEWAY_DIR, "dist");
const ENTRY_POINT = path.join(DIST_DIR, "api-gateway", "src", "index.js");

let hasErrors = false;

try {
  log("\n╔═══════════════════════════════════════════════════════════╗", "magenta");
  log("║       RENDER BUILD SIMULATION FOR API-GATEWAY            ║", "magenta");
  log("╚═══════════════════════════════════════════════════════════╝\n", "magenta");

  info(`Backend root: ${BACKEND_ROOT}`);
  info(`API Gateway: ${API_GATEWAY_DIR}`);
  info(`Expected output: ${ENTRY_POINT}\n`);

  // Step 1: Clean dist directory
  step("STEP 1: Cleaning previous build artifacts");
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    success("Removed existing dist/ directory");
  } else {
    info("No existing dist/ directory to clean");
  }

  // Step 2: Install dependencies (like Render does)
  step("STEP 2: Installing dependencies (npm install)");
  info("This simulates Render's: npm install");
  info("Running from backend root (single package.json structure)");
  try {
    // Use npm install (not ci) since Render uses install
    execSync("npm install", {
      cwd: BACKEND_ROOT,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    success("Dependencies installed successfully");
  } catch (err) {
    error("npm install failed!");
    error("This means Render will also fail at dependency installation");
    hasErrors = true;
    throw err;
  }

  // Step 3: Run build
  step("STEP 3: Building TypeScript (npm run build)");
  info("This runs: npm run build (builds shared + api-gateway)");
  try {
    execSync("npm run build", {
      cwd: BACKEND_ROOT,
      stdio: "inherit",
    });
    success("Build completed successfully");
  } catch (err) {
    error("npm run build failed!");
    error("TypeScript compilation or tsc-alias failed");
    error("Check for type errors, missing imports, or path alias issues");
    hasErrors = true;
    throw err;
  }

  // Step 4: Verify dist exists
  step("STEP 4: Verifying build output");
  if (!fs.existsSync(DIST_DIR)) {
    error("dist/ directory was not created!");
    error("The build script did not produce any output");
    hasErrors = true;
    throw new Error("Build output missing");
  }
  success("dist/ directory exists");

  // Step 5: Verify entry point exists
  if (!fs.existsSync(ENTRY_POINT)) {
    error("dist/index.js does not exist!");
    error("The build did not produce the expected entry point");
    error("Check tsconfig.json rootDir and outDir settings");
    hasErrors = true;
    throw new Error("Entry point missing");
  }
  success("dist/index.js exists");

  // Step 6: Verify entry point is valid JavaScript
  const entryContent = fs.readFileSync(ENTRY_POINT, "utf8");
  if (entryContent.length === 0) {
    error("dist/index.js is empty!");
    hasErrors = true;
    throw new Error("Entry point is empty");
  }
  success(`dist/index.js is valid (${(entryContent.length / 1024).toFixed(2)} KB)`);

  // Step 7: Check for unresolved path aliases
  info("\nScanning for unresolved path aliases...");
  const aliasPatterns = [
    /@modules\//g,
    /@common\//g,
    /@config\//g,
    /@constants\//g,
    /@shared\//g,
    /@utils\//g,
    /@types\//g,
  ];

  let unresolvedAliases = false;
  for (const pattern of aliasPatterns) {
    if (pattern.test(entryContent)) {
      error(`Found unresolved alias: ${pattern.source}`);
      error("tsc-alias did not properly resolve path aliases");
      unresolvedAliases = true;
    }
  }

  if (unresolvedAliases) {
    error("\n❌ Path aliases were not resolved!");
    error("This will cause runtime errors on Render");
    error("Check that tsc-alias is configured correctly");
    hasErrors = true;
    throw new Error("Unresolved path aliases");
  }
  success("All path aliases properly resolved");

  // Step 8: Check dist structure
  info("\nChecking dist/ structure...");
  const distContents = fs.readdirSync(DIST_DIR);
  info(`Found ${distContents.length} items in dist/:`);
  distContents.slice(0, 10).forEach((item) => {
    info(`  - ${item}`);
  });
  if (distContents.length > 10) {
    info(`  ... and ${distContents.length - 10} more`);
  }

  // Step 9: Verify main directories exist in dist
  const requiredDirs = ["api-gateway", "shared"];
  for (const dir of requiredDirs) {
    const dirPath = path.join(DIST_DIR, dir);
    if (fs.existsSync(dirPath)) {
      success(`dist/${dir}/ exists`);
    } else {
      error(`dist/${dir}/ is missing`);
      info(`  Check tsconfig include/exclude settings`);
      hasErrors = true;
    }
  }

  // Step 10: Simulate start command check
  step("STEP 5: Verifying start command readiness");
  info("Render will run: npm start");

  // Check package.json has correct start script
  const packageJson = JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, "package.json"), "utf8"));
  if (!packageJson.scripts || !packageJson.scripts.start) {
    error('package.json missing "start" script!');
    hasErrors = true;
  } else {
    success(`Start script: "${packageJson.scripts.start}"`);
  }

  // Final summary
  log("\n╔═══════════════════════════════════════════════════════════╗", "magenta");
  log("║                    SIMULATION RESULT                     ║", "magenta");
  log("╚═══════════════════════════════════════════════════════════╝\n", "magenta");

  if (hasErrors) {
    error("❌ SIMULATION FAILED");
    error("\nRender deployment will fail with these issues.");
    error("Fix the errors above before pushing to production.\n");
    process.exit(1);
  } else {
    success("✅ SIMULATION PASSED");
    success("\nYour build is ready for Render deployment!");
    info("\nRender will execute:");
    info("  1. npm install");
    info("  2. npm run build");
    info("  3. npm start\n");
    process.exit(0);
  }
} catch (err) {
  log("\n╔═══════════════════════════════════════════════════════════╗", "red");
  log("║                  SIMULATION FAILED                       ║", "red");
  log("╚═══════════════════════════════════════════════════════════╝\n", "red");

  error("An error occurred during simulation:");
  console.error(err.message || err);

  error("\n🚨 This means your Render deployment will FAIL!");
  error("Fix the issues above before committing/pushing.\n");

  process.exit(1);
}
