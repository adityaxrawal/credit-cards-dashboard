import os from 'os';
import { getPoolStats } from '../lib/db';

export class MetricsService {
    private static instance: MetricsService;

    private requests: number = 0;
    private errors: number = 0;
    private totalLatency: number = 0;
    private latencyDistribution: Record<string, number> = {
        'p50': 0, 'p90': 0, 'p99': 0
    };

    // We'll keep a simple rolling window of latencies for basic percentile calc
    private recentLatencies: number[] = [];
    private readonly WINDOW_SIZE = 1000;

    private constructor() {
        // Reset counters periodically or just keep accumulating?
        // For simplicity, we accumulate since start.
    }

    public static getInstance(): MetricsService {
        if (!MetricsService.instance) {
            MetricsService.instance = new MetricsService();
        }
        return MetricsService.instance;
    }

    public trackRequest(durationMs: number) {
        this.requests++;
        this.totalLatency += durationMs;
        this.recentLatencies.push(durationMs);
        if (this.recentLatencies.length > this.WINDOW_SIZE) {
            this.recentLatencies.shift();
        }
    }

    public trackError() {
        this.errors++;
    }

    public getSystemMetrics() {
        const mem = process.memoryUsage();
        const cpus = os.cpus();

        // Basic CPU Load (User + Sys) / Total
        // Note: os.cpus() returns total since boot. We'd need to diff for instant load.
        // For simplicity, we just return memory and uptime for now, as instantaneous CPU in Node is tricky without loop sampling.

        return {
            memory: {
                rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
            },
            uptime: Math.round(process.uptime()) + 's',
            platform: process.platform,
            nodeVersion: process.version
        };
    }

    public getDbMetrics() {
        return getPoolStats();
    }

    public getHttpMetrics() {
        const avgLatency = this.requests > 0 ? (this.totalLatency / this.requests).toFixed(2) : 0;

        // Calculate basic percentiles
        const sorted = [...this.recentLatencies].sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
        const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

        return {
            totalRequests: this.requests,
            totalErrors: this.errors,
            errorRate: this.requests > 0 ? ((this.errors / this.requests) * 100).toFixed(2) + '%' : '0%',
            latency: {
                avg: avgLatency + 'ms',
                p50: p50 + 'ms',
                p95: p95 + 'ms',
                p99: p99 + 'ms'
            }
        };
    }

    public getAllMetrics() {
        return {
            timestamp: new Date().toISOString(),
            system: this.getSystemMetrics(),
            database: this.getDbMetrics(),
            http: this.getHttpMetrics()
        };
    }
}

export const metricsService = MetricsService.getInstance();
