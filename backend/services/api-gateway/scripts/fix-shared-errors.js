#!/usr/bin/env node
/**
 * Fix shared library TypeScript errors
 */

const fs = require("fs");
const path = require("path");

const sharedDir = path.join(__dirname, "..", "..", "shared");

console.log("🔧 Fixing shared library TypeScript errors...\n");

// Fix redis.ts
const redisPath = path.join(sharedDir, "cache/redis.ts");
let redisContent = fs.readFileSync(redisPath, "utf8");

// Fix error.message
redisContent = redisContent.replace(
  "      logger.error(`Upstash Redis error: ${error.message}`);",
  "      logger.error(`Upstash Redis error: ${error instanceof Error ? error.message : String(error)}`);"
);

// Fix unused args parameter
redisContent = redisContent.replace(
  "  async set(key: string, value: any, ...args: any[]): Promise<string> {",
  "  async set(key: string, value: any, ..._args: any[]): Promise<string> {"
);

// Fix unused key parameter
redisContent = redisContent.replace(
  "  async ttl(key: string): Promise<number> {",
  "  async ttl(_key: string): Promise<number> {"
);

// Fix unused seconds parameter
redisContent = redisContent.replace(
  "  async expire(key: string, seconds: number): Promise<number> {",
  "  async expire(key: string, _seconds: number): Promise<number> {"
);

fs.writeFileSync(redisPath, redisContent, "utf8");
console.log("✅ Fixed redis.ts");

// Fix metrics-collector.ts
const metricsPath = path.join(sharedDir, "monitoring/metrics-collector.ts");
let metricsContent = fs.readFileSync(metricsPath, "utf8");

// Fix unused key parameter
metricsContent = metricsContent.replace(
  "  async recordCacheMetric(hit: boolean, key: string): Promise<void> {",
  "  async recordCacheMetric(hit: boolean, _key: string): Promise<void> {"
);

fs.writeFileSync(metricsPath, metricsContent, "utf8");
console.log("✅ Fixed metrics-collector.ts");

console.log("\n✨ Shared library fixes completed!\n");
