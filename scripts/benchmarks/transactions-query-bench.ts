#!/usr/bin/env node
/**
 * Transactions Query Benchmark Script
 *
 * Measures query performance for common transaction queries before/after composite index.
 *
 * Usage:
 *   npm run benchmark:transactions
 *
 * Expected improvement: ≥30% reduction in average query time after adding composite index
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const BENCHMARK_RUNS = 50;
const TEST_USER_ID = process.env.BENCHMARK_USER_ID || "test-user-id";
const TEST_CARD_ID = process.env.BENCHMARK_CARD_ID || "test-card-id";

interface BenchmarkResult {
  queryName: string;
  runs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  p99Ms: number;
}

interface BenchmarkResults {
  timestamp: string;
  totalRuns: number;
  queries: BenchmarkResult[];
  summary: {
    avgAcrossAllQueries: number;
    p95AcrossAllQueries: number;
  };
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Measure query execution time
 */
async function measureQuery(
  queryFn: () => Promise<any>,
  runs: number = BENCHMARK_RUNS
): Promise<number[]> {
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await queryFn();
    const end = performance.now();
    times.push(end - start);
  }

  return times;
}

/**
 * Calculate statistics from timing data
 */
function calculateStats(
  times: number[]
): Omit<BenchmarkResult, "queryName" | "runs"> {
  const sorted = times.sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  const p95Index = Math.floor(sorted.length * 0.95);
  const p99Index = Math.floor(sorted.length * 0.99);

  return {
    avgMs: Math.round(avg * 100) / 100,
    minMs: Math.round(sorted[0] * 100) / 100,
    maxMs: Math.round(sorted[sorted.length - 1] * 100) / 100,
    p95Ms: Math.round(sorted[p95Index] * 100) / 100,
    p99Ms: Math.round(sorted[p99Index] * 100) / 100,
  };
}

/**
 * Query 1: Get recent transactions for a user and specific card
 */
async function queryRecentTransactionsByCard() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", TEST_USER_ID)
    .eq("card_id", TEST_CARD_ID)
    .order("transaction_date", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
}

/**
 * Query 2: Get transactions for a user across all cards (last 30 days)
 */
async function queryRecentTransactionsByUser() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", TEST_USER_ID)
    .gte("transaction_date", thirtyDaysAgo.toISOString())
    .order("transaction_date", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

/**
 * Query 3: Get transactions for specific month and card
 */
async function queryTransactionsByMonthAndCard() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", TEST_USER_ID)
    .eq("card_id", TEST_CARD_ID)
    .gte("transaction_date", startOfMonth.toISOString())
    .lte("transaction_date", endOfMonth.toISOString())
    .order("transaction_date", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Query 4: Aggregate spending by card for user
 */
async function querySpendingByCard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("transactions")
    .select("card_id, amount")
    .eq("user_id", TEST_USER_ID)
    .gte("transaction_date", thirtyDaysAgo.toISOString());

  if (error) throw error;
  return data;
}

/**
 * Run all benchmarks
 */
async function runBenchmarks(): Promise<BenchmarkResults> {
  console.log("🚀 Starting Transaction Query Benchmarks...\n");
  console.log(`Configuration:`);
  console.log(`  - Runs per query: ${BENCHMARK_RUNS}`);
  console.log(`  - Test User ID: ${TEST_USER_ID}`);
  console.log(`  - Test Card ID: ${TEST_CARD_ID}\n`);

  const queries: Array<{
    name: string;
    fn: () => Promise<any>;
  }> = [
    {
      name: "Recent Transactions by Card (Limit 10)",
      fn: queryRecentTransactionsByCard,
    },
    {
      name: "Recent Transactions by User (30 days)",
      fn: queryRecentTransactionsByUser,
    },
    {
      name: "Monthly Transactions by Card",
      fn: queryTransactionsByMonthAndCard,
    },
    { name: "Spending Aggregation by Card", fn: querySpendingByCard },
  ];

  const results: BenchmarkResult[] = [];
  let totalAvg = 0;
  let totalP95 = 0;

  for (const query of queries) {
    console.log(`📊 Benchmarking: ${query.name}...`);

    const times = await measureQuery(query.fn, BENCHMARK_RUNS);
    const stats = calculateStats(times);

    const result: BenchmarkResult = {
      queryName: query.name,
      runs: BENCHMARK_RUNS,
      ...stats,
    };

    results.push(result);
    totalAvg += stats.avgMs;
    totalP95 += stats.p95Ms;

    console.log(
      `   Avg: ${stats.avgMs}ms | P95: ${stats.p95Ms}ms | P99: ${stats.p99Ms}ms\n`
    );
  }

  const benchmarkResults: BenchmarkResults = {
    timestamp: new Date().toISOString(),
    totalRuns: BENCHMARK_RUNS * queries.length,
    queries: results,
    summary: {
      avgAcrossAllQueries: Math.round((totalAvg / queries.length) * 100) / 100,
      p95AcrossAllQueries: Math.round((totalP95 / queries.length) * 100) / 100,
    },
  };

  return benchmarkResults;
}

/**
 * Display results and save to file
 */
async function main() {
  try {
    const results = await runBenchmarks();

    console.log("\n" + "=".repeat(80));
    console.log("📈 BENCHMARK RESULTS SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Runs: ${results.totalRuns}`);
    console.log(
      `Average across all queries: ${results.summary.avgAcrossAllQueries}ms`
    );
    console.log(
      `P95 across all queries: ${results.summary.p95AcrossAllQueries}ms`
    );
    console.log("=".repeat(80));

    console.log("\n📋 Detailed Results:\n");
    console.table(
      results.queries.map((q) => ({
        Query: q.queryName,
        "Avg (ms)": q.avgMs,
        "Min (ms)": q.minMs,
        "Max (ms)": q.maxMs,
        "P95 (ms)": q.p95Ms,
        "P99 (ms)": q.p99Ms,
      }))
    );

    // Save results to JSON file
    const fs = await import("fs/promises");
    const filename = `benchmark-results-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(results, null, 2));

    console.log(`\n✅ Results saved to: ${filename}`);
    console.log("\n💡 To compare before/after index performance:");
    console.log("   1. Run this script BEFORE adding the composite index");
    console.log("   2. Apply migration 020 (composite index)");
    console.log("   3. Run this script AFTER adding the index");
    console.log(
      "   4. Compare the average query times - expect ≥30% improvement\n"
    );
  } catch (error) {
    console.error("❌ Benchmark failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runBenchmarks, measureQuery, calculateStats };
