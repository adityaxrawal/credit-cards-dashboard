/**
 * CircuitBreakerManager - Fault isolation for external dependencies
 * 
 * Provides independent circuit breakers for:
 * - Gmail API (429s, rate limits)
 * - Database writes (connection failures)
 * - GPT API (rate limits, timeouts)
 * 
 * Rules:
 * - Gmail failure does NOT stop processing
 * - DB failure does NOT stop fetch or processing
 * - GPT failure does NOT block rule-based flow
 */

import logger from '@shared/utils/infrastructure/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
    name: string;
    failureThreshold: number;      // Number of failures before opening
    resetTimeoutMs: number;        // Time before attempting reset
    halfOpenMaxAttempts: number;   // Successful calls needed to close
}

interface CircuitStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    lastError: string | null;
    totalTrips: number;
}

class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private successes = 0;
    private lastFailureTime: number | null = null;
    private lastError: string | null = null;
    private totalTrips = 0;
    private halfOpenAttempts = 0;

    constructor(private config: CircuitBreakerConfig) { }

    get name(): string {
        return this.config.name;
    }

    /**
     * Check if the circuit allows requests
     */
    canExecute(): boolean {
        if (this.state === 'CLOSED') {
            return true;
        }

        if (this.state === 'OPEN') {
            // Check if reset timeout has passed
            const now = Date.now();
            if (this.lastFailureTime && now - this.lastFailureTime >= this.config.resetTimeoutMs) {
                this.transitionTo('HALF_OPEN');
                return true;
            }
            return false;
        }

        // HALF_OPEN - allow limited attempts
        return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
    }

    /**
     * Record a successful execution
     */
    recordSuccess(): void {
        this.failures = 0;
        this.successes++;

        if (this.state === 'HALF_OPEN') {
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
                this.transitionTo('CLOSED');
            }
        }
    }

    /**
     * Record a failed execution
     */
    recordFailure(error: Error | string): void {
        this.failures++;
        this.lastFailureTime = Date.now();
        this.lastError = error instanceof Error ? error.message : error;

        if (this.state === 'HALF_OPEN') {
            // Any failure in HALF_OPEN returns to OPEN
            this.transitionTo('OPEN');
            return;
        }

        if (this.state === 'CLOSED' && this.failures >= this.config.failureThreshold) {
            this.transitionTo('OPEN');
        }
    }

    /**
     * Get current stats
     */
    getStats(): CircuitStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailureTime: this.lastFailureTime,
            lastError: this.lastError,
            totalTrips: this.totalTrips,
        };
    }

    /**
     * Force reset (for testing or admin override)
     */
    reset(): void {
        this.state = 'CLOSED';
        this.failures = 0;
        this.halfOpenAttempts = 0;
        this.lastError = null;
        logger.info(`[CircuitBreaker:${this.config.name}] Manually reset`);
    }

    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        if (newState === 'OPEN') {
            this.totalTrips++;
            logger.warn(`[CircuitBreaker:${this.config.name}] OPENED after ${this.failures} failures. Last error: ${this.lastError}`);
        } else if (newState === 'HALF_OPEN') {
            this.halfOpenAttempts = 0;
            logger.info(`[CircuitBreaker:${this.config.name}] Transitioning to HALF_OPEN after ${this.config.resetTimeoutMs}ms`);
        } else if (newState === 'CLOSED') {
            this.failures = 0;
            this.halfOpenAttempts = 0;
            logger.info(`[CircuitBreaker:${this.config.name}] CLOSED - service recovered`);
        }
    }
}

/**
 * Execute a function with circuit breaker protection
 */
async function executeWithBreaker<T>(
    breaker: CircuitBreaker,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
): Promise<T> {
    if (!breaker.canExecute()) {
        logger.debug(`[CircuitBreaker:${breaker.name}] Circuit OPEN, using fallback`);
        if (fallback) {
            return fallback();
        }
        throw new Error(`Circuit breaker ${breaker.name} is OPEN`);
    }

    try {
        const result = await fn();
        breaker.recordSuccess();
        return result;
    } catch (error) {
        breaker.recordFailure(error instanceof Error ? error : new Error(String(error)));

        if (fallback) {
            return fallback();
        }
        throw error;
    }
}

/**
 * CircuitBreakerManager - Singleton manager for all circuit breakers
 */
export class CircuitBreakerManager {
    private static instance: CircuitBreakerManager;

    // Independent circuit breakers for each external dependency
    public readonly gmail: CircuitBreaker;
    public readonly database: CircuitBreaker;
    public readonly gpt: CircuitBreaker;

    private constructor() {
        this.gmail = new CircuitBreaker({
            name: 'gmail',
            failureThreshold: 5,          // Open after 5 failures
            resetTimeoutMs: 30000,        // 30 seconds before retry
            halfOpenMaxAttempts: 3,       // 3 successful calls to close
        });

        this.database = new CircuitBreaker({
            name: 'database',
            failureThreshold: 10,         // Higher threshold for DB
            resetTimeoutMs: 15000,        // 15 seconds
            halfOpenMaxAttempts: 5,       // 5 successful writes to close
        });

        this.gpt = new CircuitBreaker({
            name: 'gpt',
            failureThreshold: 3,          // Lower threshold for API
            resetTimeoutMs: 60000,        // 60 seconds (rate limits)
            halfOpenMaxAttempts: 2,       // 2 successful calls to close
        });
    }

    static getInstance(): CircuitBreakerManager {
        if (!CircuitBreakerManager.instance) {
            CircuitBreakerManager.instance = new CircuitBreakerManager();
        }
        return CircuitBreakerManager.instance;
    }

    /**
     * Execute with Gmail circuit breaker
     */
    async withGmail<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
        return executeWithBreaker(this.gmail, fn, fallback);
    }

    /**
     * Execute with Database circuit breaker
     */
    async withDatabase<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
        return executeWithBreaker(this.database, fn, fallback);
    }

    /**
     * Execute with GPT circuit breaker
     */
    async withGpt<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
        return executeWithBreaker(this.gpt, fn, fallback);
    }

    /**
     * Get all breaker stats
     */
    getAllStats(): Record<string, CircuitStats> {
        return {
            gmail: this.gmail.getStats(),
            database: this.database.getStats(),
            gpt: this.gpt.getStats(),
        };
    }

    /**
     * Reset all breakers
     */
    resetAll(): void {
        this.gmail.reset();
        this.database.reset();
        this.gpt.reset();
    }
}

// Export singleton instance
export const circuitBreakerManager = CircuitBreakerManager.getInstance();
