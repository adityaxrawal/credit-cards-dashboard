/**
 * Real-time Metrics Collection Service
 * Phase 6: Post-Launch & Optimization
 */
export interface MetricData {
    name: string;
    value: number;
    timestamp: number;
    tags?: Record<string, string>;
}
export interface PerformanceMetric {
    service: string;
    operation: string;
    duration: number;
    success: boolean;
    timestamp: number;
}
export interface UsageMetric {
    userId?: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    timestamp: number;
}
export declare class MetricsCollector {
    private redisClient;
    private metricsBuffer;
    private flushInterval;
    private readonly BUFFER_SIZE;
    private readonly FLUSH_INTERVAL;
    constructor();
    private initializeRedis;
    private startFlushInterval;
    /**
     * Record a performance metric
     */
    recordPerformance(metric: PerformanceMetric): Promise<void>;
    /**
     * Record API usage metric
     */
    recordUsage(metric: UsageMetric): Promise<void>;
    /**
     * Record custom metric
     */
    recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;
    /**
     * Increment a counter
     */
    incrementCounter(name: string, tags?: Record<string, string>): Promise<void>;
    /**
     * Record cache hit/miss
     */
    recordCacheMetric(hit: boolean, key: string): Promise<void>;
    /**
     * Get current metrics summary
     */
    getMetricsSummary(): Promise<any>;
    /**
     * Flush metrics buffer
     */
    private flush;
    /**
     * Aggregate metrics for summary
     */
    private aggregateMetrics;
    /**
     * Cleanup on shutdown
     */
    shutdown(): Promise<void>;
}
export declare const metricsCollector: MetricsCollector;
/**
 * Helper function to measure operation duration
 */
export declare function measurePerformance<T>(service: string, operation: string, fn: () => Promise<T>): Promise<T>;
