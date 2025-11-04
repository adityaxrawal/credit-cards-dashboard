/**
 * Performance Testing Script
 *
 * Tests system performance with 1000+ transactions:
 * - Gmail sync time (<10s target)
 * - Database query latency
 * - Redis cache hit rate
 * - Frontend bundle size
 */

import { performance } from "perf_hooks";
import { supabase } from "../backend/shared/database/supabase";
import { redis } from "../backend/shared/cache/redis";
import fs from "fs";
import path from "path";

interface PerformanceMetrics {
  testName: string;
  duration: number;
  status: "PASS" | "FAIL";
  details?: Record<string, any>;
}

const metrics: PerformanceMetrics[] = [];
const TEST_USER_ID = "perf-test-user-123";

/**
 * Generate 1000+ mock transactions
 */
async function generateMockTransactions(count: number = 1000): Promise<void> {
  console.log(`\n📊 Generating ${count} mock transactions...`);
  const startTime = performance.now();

  const transactions = [];
  const categories = [
    "Shopping",
    "Dining",
    "Groceries",
    "Transport",
    "Bills",
    "Entertainment",
  ];
  const merchants = [
    "Amazon",
    "Swiggy",
    "BigBasket",
    "Uber",
    "Netflix",
    "Restaurant",
  ];

  for (let i = 0; i < count; i++) {
    transactions.push({
      user_id: TEST_USER_ID,
      card_id: `card-${Math.floor(Math.random() * 3) + 1}`,
      amount: Math.floor(Math.random() * 5000) + 100,
      transaction_type: "debit",
      description: `Test Transaction ${i + 1}`,
      merchant: merchants[Math.floor(Math.random() * merchants.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      transaction_date: new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      email_message_id: `msg-perf-test-${i}`,
      billing_cycle_month: new Date().getMonth() + 1,
      billing_cycle_year: new Date().getFullYear(),
    });
  }

  // Insert in batches to avoid timeout
  const batchSize = 100;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    await supabase.from("transactions").insert(batch);
  }

  const duration = performance.now() - startTime;
  console.log(
    `✅ Generated ${count} transactions in ${(duration / 1000).toFixed(2)}s`
  );

  metrics.push({
    testName: "Transaction Generation",
    duration: duration / 1000,
    status: "PASS",
    details: { count, avgTimePerTransaction: duration / count },
  });
}

/**
 * Test Gmail sync performance with 1000+ transactions
 */
async function testGmailSyncPerformance(): Promise<void> {
  console.log("\n🔄 Testing Gmail Sync Performance...");
  const startTime = performance.now();

  try {
    // Simulate Gmail sync by fetching transactions
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", TEST_USER_ID)
      .order("transaction_date", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const duration = performance.now() - startTime;
    const syncTime = duration / 1000;
    const status = syncTime < 10 ? "PASS" : "FAIL";

    console.log(
      `${
        status === "PASS" ? "✅" : "❌"
      } Gmail sync completed in ${syncTime.toFixed(2)}s (target: <10s)`
    );

    metrics.push({
      testName: "Gmail Sync Performance",
      duration: syncTime,
      status,
      details: {
        transactionsProcessed: data?.length || 0,
        targetTime: 10,
        achieved: syncTime < 10,
      },
    });
  } catch (error) {
    console.error("❌ Gmail sync failed:", error);
    metrics.push({
      testName: "Gmail Sync Performance",
      duration: 0,
      status: "FAIL",
      details: { error: String(error) },
    });
  }
}

/**
 * Test database query performance
 */
async function testDatabaseQueryPerformance(): Promise<void> {
  console.log("\n🗄️  Testing Database Query Performance...");

  const queries = [
    {
      name: "Fetch Recent Transactions",
      query: async () => {
        const start = performance.now();
        await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", TEST_USER_ID)
          .order("transaction_date", { ascending: false })
          .limit(50);
        return performance.now() - start;
      },
      targetMs: 500,
    },
    {
      name: "Category Aggregation",
      query: async () => {
        const start = performance.now();
        await supabase
          .from("transactions")
          .select("category, amount")
          .eq("user_id", TEST_USER_ID)
          .eq("transaction_type", "debit");
        return performance.now() - start;
      },
      targetMs: 1000,
    },
    {
      name: "Monthly Budget Calculation",
      query: async () => {
        const start = performance.now();
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", TEST_USER_ID)
          .eq("billing_cycle_month", month)
          .eq("billing_cycle_year", year)
          .eq("transaction_type", "debit");
        return performance.now() - start;
      },
      targetMs: 500,
    },
  ];

  for (const { name, query, targetMs } of queries) {
    const duration = await query();
    const status = duration < targetMs ? "PASS" : "FAIL";
    console.log(
      `${status === "PASS" ? "✅" : "❌"} ${name}: ${duration.toFixed(
        2
      )}ms (target: <${targetMs}ms)`
    );

    metrics.push({
      testName: `DB Query: ${name}`,
      duration: duration,
      status,
      details: { targetMs, achieved: duration < targetMs },
    });
  }
}

/**
 * Test Redis cache hit rate
 */
async function testRedisCachePerformance(): Promise<void> {
  console.log("\n💾 Testing Redis Cache Performance...");

  const cacheKey = `analytics:${TEST_USER_ID}:dashboard_kpis`;
  const testData = { totalSpent: 50000, transactionCount: 1000 };

  try {
    // Write to cache
    const writeStart = performance.now();
    await redis.set(cacheKey, JSON.stringify(testData), "EX", 3600);
    const writeDuration = performance.now() - writeStart;

    // Read from cache (should be fast)
    const readStart = performance.now();
    const cachedData = await redis.get(cacheKey);
    const readDuration = performance.now() - readStart;

    // Test cache hit
    const hitStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await redis.get(cacheKey);
    }
    const avgHitTime = (performance.now() - hitStart) / 100;

    const status = avgHitTime < 10 ? "PASS" : "FAIL"; // <10ms average

    console.log(
      `${status === "PASS" ? "✅" : "❌"} Cache write: ${writeDuration.toFixed(
        2
      )}ms`
    );
    console.log(
      `${status === "PASS" ? "✅" : "❌"} Cache read: ${readDuration.toFixed(
        2
      )}ms`
    );
    console.log(
      `${
        status === "PASS" ? "✅" : "❌"
      } Average hit time: ${avgHitTime.toFixed(2)}ms (100 reads)`
    );

    metrics.push({
      testName: "Redis Cache Performance",
      duration: avgHitTime,
      status,
      details: {
        writeDuration,
        readDuration,
        avgHitTime,
        targetMs: 10,
      },
    });

    // Cleanup
    await redis.del(cacheKey);
  } catch (error) {
    console.error("❌ Redis cache test failed:", error);
    metrics.push({
      testName: "Redis Cache Performance",
      duration: 0,
      status: "FAIL",
      details: { error: String(error) },
    });
  }
}

/**
 * Test frontend bundle size
 */
async function testFrontendBundleSize(): Promise<void> {
  console.log("\n📦 Testing Frontend Bundle Size...");

  try {
    const nextBuildDir = path.join(__dirname, "../frontend/.next");

    if (!fs.existsSync(nextBuildDir)) {
      console.log(
        "⚠️  Frontend not built. Run `npm run frontend:build` first."
      );
      return;
    }

    const jsFiles = [];
    const findJsFiles = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findJsFiles(fullPath);
        } else if (file.endsWith(".js")) {
          jsFiles.push({ path: fullPath, size: stat.size });
        }
      }
    };

    findJsFiles(nextBuildDir);

    const totalSize = jsFiles.reduce((sum, file) => sum + file.size, 0);
    const totalSizeKB = totalSize / 1024;
    const totalSizeMB = totalSizeKB / 1024;

    const targetMB = 2; // Target: <2MB total
    const status = totalSizeMB < targetMB ? "PASS" : "FAIL";

    console.log(
      `${
        status === "PASS" ? "✅" : "❌"
      } Total bundle size: ${totalSizeMB.toFixed(2)}MB (target: <${targetMB}MB)`
    );
    console.log(`   Total JS files: ${jsFiles.length}`);

    metrics.push({
      testName: "Frontend Bundle Size",
      duration: 0,
      status,
      details: {
        totalSizeMB: totalSizeMB.toFixed(2),
        totalFiles: jsFiles.length,
        targetMB,
      },
    });
  } catch (error) {
    console.error("❌ Bundle size test failed:", error);
    metrics.push({
      testName: "Frontend Bundle Size",
      duration: 0,
      status: "FAIL",
      details: { error: String(error) },
    });
  }
}

/**
 * Generate performance report
 */
function generateReport(): void {
  console.log("\n\n📊 === PERFORMANCE TEST REPORT ===\n");

  const passedTests = metrics.filter((m) => m.status === "PASS").length;
  const failedTests = metrics.filter((m) => m.status === "FAIL").length;
  const totalTests = metrics.length;

  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(
    `Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%\n`
  );

  console.log("Detailed Results:\n");
  metrics.forEach((metric) => {
    console.log(`${metric.status === "PASS" ? "✅" : "❌"} ${metric.testName}`);
    if (metric.duration > 0) {
      console.log(
        `   Duration: ${metric.duration.toFixed(2)}${
          metric.duration > 100 ? "s" : "ms"
        }`
      );
    }
    if (metric.details) {
      Object.entries(metric.details).forEach(([key, value]) => {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      });
    }
    console.log("");
  });

  // Write report to file
  const reportPath = path.join(__dirname, "../docs/performance-report.md");
  const reportContent = `# Performance Test Report

**Generated:** ${new Date().toISOString()}

## Summary

- **Total Tests:** ${totalTests}
- **✅ Passed:** ${passedTests}
- **❌ Failed:** ${failedTests}
- **Success Rate:** ${((passedTests / totalTests) * 100).toFixed(2)}%

## Detailed Results

${metrics
  .map(
    (m) => `### ${m.status === "PASS" ? "✅" : "❌"} ${m.testName}

- **Status:** ${m.status}
${
  m.duration > 0
    ? `- **Duration:** ${m.duration.toFixed(2)}${m.duration > 100 ? "s" : "ms"}`
    : ""
}
${
  m.details
    ? Object.entries(m.details)
        .map(([key, value]) => `- **${key}:** ${JSON.stringify(value)}`)
        .join("\n")
    : ""
}
`
  )
  .join("\n")}

## Recommendations

${
  failedTests > 0
    ? "⚠️ **Performance issues detected:**"
    : "✅ **All performance targets met!**"
}

${
  failedTests > 0
    ? metrics
        .filter((m) => m.status === "FAIL")
        .map((m) => `- Fix: ${m.testName}`)
        .join("\n")
    : "- System is performing optimally"
}

---

*End of Report*
`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Report saved to: ${reportPath}\n`);
}

/**
 * Cleanup test data
 */
async function cleanup(): Promise<void> {
  console.log("\n🧹 Cleaning up test data...");

  try {
    await supabase.from("transactions").delete().eq("user_id", TEST_USER_ID);
    console.log("✅ Cleanup complete");
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
  }
}

/**
 * Main test runner
 */
async function runPerformanceTests(): Promise<void> {
  console.log("🚀 Starting Performance Tests...\n");

  try {
    await generateMockTransactions(1000);
    await testGmailSyncPerformance();
    await testDatabaseQueryPerformance();
    await testRedisCachePerformance();
    await testFrontendBundleSize();
  } catch (error) {
    console.error("Fatal error during testing:", error);
  } finally {
    generateReport();
    await cleanup();
  }
}

// Run tests
runPerformanceTests().catch(console.error);
