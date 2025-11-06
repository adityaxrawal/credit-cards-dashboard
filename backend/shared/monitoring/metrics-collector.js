"use strict";
/**
 * Real-time Metrics Collection Service
 * Phase 6: Post-Launch & Optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsCollector = exports.MetricsCollector = void 0;
exports.measurePerformance = measurePerformance;
const redis_1 = require("redis");
const perf_hooks_1 = require("perf_hooks");
class MetricsCollector {
    constructor() {
        this.redisClient = null;
        this.metricsBuffer = [];
        this.flushInterval = null;
        this.BUFFER_SIZE = 100;
        this.FLUSH_INTERVAL = 5000; // 5 seconds
        this.initializeRedis();
        this.startFlushInterval();
    }
    async initializeRedis() {
        try {
            this.redisClient = (0, redis_1.createClient)({
                url: process.env.REDIS_URL || "redis://localhost:6379",
            });
            this.redisClient.on("error", (err) => {
                console.error("Redis Client Error:", err);
            });
            await this.redisClient.connect();
            console.log("✅ Metrics Collector: Redis connected");
        }
        catch (error) {
            console.error("Failed to connect to Redis for metrics:", error);
        }
    }
    startFlushInterval() {
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.FLUSH_INTERVAL);
    }
    /**
     * Record a performance metric
     */
    async recordPerformance(metric) {
        const metricData = {
            name: "performance",
            value: metric.duration,
            timestamp: metric.timestamp,
            tags: {
                service: metric.service,
                operation: metric.operation,
                success: metric.success.toString(),
            },
        };
        this.metricsBuffer.push(metricData);
        // Store in Redis for real-time access
        if (this.redisClient) {
            const key = `metrics:performance:${metric.service}:${metric.operation}`;
            await this.redisClient.lPush(key, JSON.stringify(metric));
            await this.redisClient.lTrim(key, 0, 999); // Keep last 1000
            await this.redisClient.expire(key, 86400); // 24 hours
        }
        if (this.metricsBuffer.length >= this.BUFFER_SIZE) {
            await this.flush();
        }
    }
    /**
     * Record API usage metric
     */
    async recordUsage(metric) {
        const metricData = {
            name: "api_usage",
            value: metric.responseTime,
            timestamp: metric.timestamp,
            tags: {
                endpoint: metric.endpoint,
                method: metric.method,
                status: metric.statusCode.toString(),
            },
        };
        this.metricsBuffer.push(metricData);
        if (this.redisClient) {
            // Increment endpoint counter
            const counterKey = `metrics:counter:${metric.method}:${metric.endpoint}`;
            await this.redisClient.incr(counterKey);
            await this.redisClient.expire(counterKey, 86400);
            // Record response time
            const timeKey = `metrics:response_time:${metric.endpoint}`;
            await this.redisClient.lPush(timeKey, metric.responseTime.toString());
            await this.redisClient.lTrim(timeKey, 0, 999);
            await this.redisClient.expire(timeKey, 86400);
        }
    }
    /**
     * Record custom metric
     */
    async recordMetric(name, value, tags) {
        const metricData = {
            name,
            value,
            timestamp: Date.now(),
            tags,
        };
        this.metricsBuffer.push(metricData);
        if (this.redisClient) {
            const key = `metrics:custom:${name}`;
            await this.redisClient.lPush(key, JSON.stringify(metricData));
            await this.redisClient.lTrim(key, 0, 999);
            await this.redisClient.expire(key, 86400);
        }
    }
    /**
     * Increment a counter
     */
    async incrementCounter(name, tags) {
        await this.recordMetric(name, 1, tags);
    }
    /**
     * Record cache hit/miss
     */
    async recordCacheMetric(hit, key) {
        if (this.redisClient) {
            const metricKey = hit ? "metrics:cache:hits" : "metrics:cache:misses";
            await this.redisClient.incr(metricKey);
            await this.redisClient.expire(metricKey, 86400);
        }
    }
    /**
     * Get current metrics summary
     */
    async getMetricsSummary() {
        if (!this.redisClient) {
            return null;
        }
        const [cacheHits, cacheMisses] = await Promise.all([
            this.redisClient.get("metrics:cache:hits"),
            this.redisClient.get("metrics:cache:misses"),
        ]);
        const hits = parseInt(cacheHits || "0", 10);
        const misses = parseInt(cacheMisses || "0", 10);
        const total = hits + misses;
        const hitRate = total > 0 ? (hits / total) * 100 : 0;
        return {
            cache: {
                hits,
                misses,
                total,
                hitRate: hitRate.toFixed(2) + "%",
            },
            timestamp: Date.now(),
        };
    }
    /**
     * Flush metrics buffer
     */
    async flush() {
        if (this.metricsBuffer.length === 0) {
            return;
        }
        const metrics = [...this.metricsBuffer];
        this.metricsBuffer = [];
        // Here you would send to your metrics backend (e.g., Datadog, Prometheus)
        console.log(`📊 Flushed ${metrics.length} metrics`);
        // Store aggregated metrics in Redis
        if (this.redisClient) {
            const aggregated = this.aggregateMetrics(metrics);
            await this.redisClient.set("metrics:aggregated:latest", JSON.stringify(aggregated), { EX: 3600 });
        }
    }
    /**
     * Aggregate metrics for summary
     */
    aggregateMetrics(metrics) {
        const grouped = metrics.reduce((acc, metric) => {
            if (!acc[metric.name]) {
                acc[metric.name] = [];
            }
            acc[metric.name].push(metric.value);
            return acc;
        }, {});
        const aggregated = {};
        Object.entries(grouped).forEach(([name, values]) => {
            const sorted = values.sort((a, b) => a - b);
            aggregated[name] = {
                count: values.length,
                sum: values.reduce((a, b) => a + b, 0),
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                min: sorted[0],
                max: sorted[sorted.length - 1],
                p50: sorted[Math.floor(sorted.length * 0.5)],
                p95: sorted[Math.floor(sorted.length * 0.95)],
                p99: sorted[Math.floor(sorted.length * 0.99)],
            };
        });
        return aggregated;
    }
    /**
     * Cleanup on shutdown
     */
    async shutdown() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        await this.flush();
        if (this.redisClient) {
            await this.redisClient.quit();
        }
    }
}
exports.MetricsCollector = MetricsCollector;
// Singleton instance
exports.metricsCollector = new MetricsCollector();
/**
 * Helper function to measure operation duration
 */
async function measurePerformance(service, operation, fn) {
    const start = perf_hooks_1.performance.now();
    let success = true;
    try {
        const result = await fn();
        return result;
    }
    catch (error) {
        success = false;
        throw error;
    }
    finally {
        const duration = perf_hooks_1.performance.now() - start;
        await exports.metricsCollector.recordPerformance({
            service,
            operation,
            duration,
            success,
            timestamp: Date.now(),
        });
    }
}
//# sourceMappingURL=metrics-collector.js.map