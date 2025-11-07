/**
 * Health Check Service
 * Phase 6: Post-Launch & Optimization
 */
export interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: number;
    services: {
        database: ServiceHealth;
        redis: ServiceHealth;
        api: ServiceHealth;
    };
    uptime: number;
    version: string;
}
export interface ServiceHealth {
    status: "up" | "down" | "degraded";
    latency?: number;
    message?: string;
}
/**
 * Perform comprehensive health check
 */
export declare function healthCheck(): Promise<HealthStatus>;
