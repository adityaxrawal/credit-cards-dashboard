#!/usr/bin/env node
/**
 * Cache Warmup and Metrics Benchmark Script
 *
 * Warms up cache with test data and measures hit/miss ratios.
 *
 * Usage:
 *   npm run benchmark:cache
 *
 * Expected: Hit rate ≥90% after warmup for dashboard read patterns
 */

import redis from "../../backend/services/shared/cache/redis";
import { cacheKey } from "../../backend/services/shared/cache/key-utils";
import {
  incrementCacheHit,
  incrementCacheMiss,
  getCacheMetricsForUser,
  getCacheMetricsForModule,
  getGlobalCacheMetrics,
  resetCacheMetrics,
} from "../../backend/services/shared/cache/cache-metrics";

const TEST_USER_ID = "test-user-123";
const TEST_MODULES = ["analytics", "transactions", "dashboard", "budgets"];
const WARMUP_KEYS = 20;
const READ_ITERATIONS = 1000;

interface CacheBenchmarkResult {
  timestamp: string;
  warmupPhase: {
    keysWarmed: number;
    durationMs: number;
  };
  readPhase: {
    totalReads: number;
    durationMs: number;
  };
  metrics: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    byModule: Record<string, any>;
  };
}

/**
 * Warmup cache with test data
 */
async function warmupCache(): Promise<number> {
  console.log("🔥 Warming up cache...");
  let keysWarmed = 0;

  for (const module of TEST_MODULES) {
    for (let i = 0; i < WARMUP_KEYS / TEST_MODULES.length; i++) {
      const key = cacheKey(module, TEST_USER_ID, `resource-${i}`);
      await redis.set(
        key,
        JSON.stringify({ data: `test-${i}`, timestamp: Date.now() }),
        "EX",
        300
      );
      keysWarmed++;
    }
  }

  console.log(`   ✅ Warmed ${keysWarmed} cache keys\n`);
  return keysWarmed;
}

/**
 * Simulate cache read patterns
 */
async function simulateCacheReads(iterations: number): Promise<void> {
  console.log(`📖 Simulating ${iterations} cache reads...`);

  for (let i = 0; i < iterations; i++) {
    const module = TEST_MODULES[i % TEST_MODULES.length];
    const resourceId = Math.floor(
      Math.random() * (WARMUP_KEYS / TEST_MODULES.length)
    );
    const key = cacheKey(module, TEST_USER_ID, `resource-${resourceId}`);

    const cached = await redis.get(key);

    if (cached) {
      incrementCacheHit(module, TEST_USER_ID, `resource-${resourceId}`);
    } else {
      incrementCacheMiss(module, TEST_USER_ID, `resource-${resourceId}`);
    }

    // Simulate some cache misses intentionally (20% miss rate expected)
    if (Math.random() < 0.2) {
      const missKey = cacheKey(module, TEST_USER_ID, `missing-${i}`);
      await redis.get(missKey);
      incrementCacheMiss(module, TEST_USER_ID, `missing-${i}`);
    }
  }

  console.log(`   ✅ Completed ${iterations} reads\n`);
}

/**
 * Run cache benchmark
 */
async function runCacheBenchmark(): Promise<CacheBenchmarkResult> {
  console.log("🚀 Starting Cache Benchmark...\n");

  // Reset metrics
  resetCacheMetrics();

  // Phase 1: Warmup
  const warmupStart = performance.now();
  const keysWarmed = await warmupCache();
  const warmupEnd = performance.now();
  const warmupDuration = Math.round(warmupEnd - warmupStart);

  // Phase 2: Read simulation
  const readStart = performance.now();
  await simulateCacheReads(READ_ITERATIONS);
  const readEnd = performance.now();
  const readDuration = Math.round(readEnd - readStart);

  // Collect metrics
  const globalMetrics = getGlobalCacheMetrics();
  const moduleMetrics: Record<string, any> = {};

  TEST_MODULES.forEach((module) => {
    moduleMetrics[module] = getCacheMetricsForUser(module, TEST_USER_ID);
  });

  const result: CacheBenchmarkResult = {
    timestamp: new Date().toISOString(),
    warmupPhase: {
      keysWarmed,
      durationMs: warmupDuration,
    },
    readPhase: {
      totalReads: READ_ITERATIONS,
      durationMs: readDuration,
    },
    metrics: {
      totalHits: globalMetrics.totalHits,
      totalMisses: globalMetrics.totalMisses,
      hitRate: globalMetrics.hitRate,
      byModule: moduleMetrics,
    },
  };

  return result;
}

/**
 * Display and save results
 */
async function main() {
  try {
    const results = await runCacheBenchmark();

    console.log("\n" + "=".repeat(80));
    console.log("📊 CACHE BENCHMARK RESULTS");
    console.log("=".repeat(80));

    console.log("\n🔥 Warmup Phase:");
    console.log(`   Keys warmed: ${results.warmupPhase.keysWarmed}`);
    console.log(`   Duration: ${results.warmupPhase.durationMs}ms`);

    console.log("\n📖 Read Phase:");
    console.log(`   Total reads: ${results.readPhase.totalReads}`);
    console.log(`   Duration: ${results.readPhase.durationMs}ms`);
    console.log(
      `   Avg per read: ${(
        results.readPhase.durationMs / results.readPhase.totalReads
      ).toFixed(2)}ms`
    );

    console.log("\n📈 Cache Metrics:");
    console.log(`   Total hits: ${results.metrics.totalHits}`);
    console.log(`   Total misses: ${results.metrics.totalMisses}`);
    console.log(`   Hit rate: ${results.metrics.hitRate.toFixed(2)}%`);

    console.log("\n📊 By Module:");
    console.table(
      Object.entries(results.metrics.byModule).map(
        ([module, metrics]: [string, any]) => ({
          Module: module,
          Hits: metrics.totalHits,
          Misses: metrics.totalMisses,
          "Hit Rate (%)": metrics.hitRate.toFixed(2),
        })
      )
    );

    // Save results
    const fs = await import("fs/promises");
    const filename = `cache-benchmark-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(results, null, 2));

    console.log(`\n✅ Results saved to: ${filename}`);

    // Validation
    if (results.metrics.hitRate >= 90) {
      console.log("\n✅ SUCCESS: Hit rate ≥90% achieved!");
    } else {
      console.log(
        `\n⚠️  WARNING: Hit rate ${results.metrics.hitRate.toFixed(
          2
        )}% is below 90% target`
      );
    }

    console.log("\n" + "=".repeat(80));

    // Cleanup
    console.log("\n🧹 Cleaning up test cache keys...");
    for (const module of TEST_MODULES) {
      for (let i = 0; i < WARMUP_KEYS / TEST_MODULES.length; i++) {
        const key = cacheKey(module, TEST_USER_ID, `resource-${i}`);
        await redis.del(key);
      }
    }
    console.log("   ✅ Cleanup complete\n");
  } catch (error) {
    console.error("❌ Cache benchmark failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { runCacheBenchmark, warmupCache, simulateCacheReads };
