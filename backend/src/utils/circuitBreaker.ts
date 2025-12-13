import logger from './logger';

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
    failureThreshold?: number; // Number of failures to trip
    resetTimeout?: number; // Time in ms before trying again (HALF_OPEN)
}

export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount = 0;
    private failureThreshold: number;
    private resetTimeout: number;
    private nextAttemptTimestamp = 0;

    constructor(private name: string, options: CircuitBreakerOptions = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000; // 30s
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() > this.nextAttemptTimestamp) {
                this.state = CircuitState.HALF_OPEN;
                logger.info(`[CircuitBreaker:${this.name}] Moving to HALF_OPEN, trying request...`);
            } else {
                throw new Error(`CircuitBreaker '${this.name}' is OPEN. Failing fast.`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    private onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            logger.info(`[CircuitBreaker:${this.name}] Request successful. Closing circuit.`);
            this.state = CircuitState.CLOSED;
            this.failureCount = 0;
        } else if (this.state === CircuitState.CLOSED) {
            // Reset failure count on success if we want a "consecutive failures" policy
            // Often standard CBs reset count on success
            this.failureCount = 0;
        }
    }

    private onFailure(error: any) {
        this.failureCount++;
        logger.warn(`[CircuitBreaker:${this.name}] Failure recorded (${this.failureCount}/${this.failureThreshold}). Error: ${error.message}`);

        if (this.state === CircuitState.HALF_OPEN) {
            // Failed immediately in test probe, go back to open
            this.state = CircuitState.OPEN;
            this.nextAttemptTimestamp = Date.now() + this.resetTimeout;
            logger.warn(`[CircuitBreaker:${this.name}] Probe failed. Re-opening circuit.`);
        } else if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttemptTimestamp = Date.now() + this.resetTimeout;
            logger.error(`[CircuitBreaker:${this.name}] Threshold reached. Opening circuit for ${this.resetTimeout}ms.`);
        }
    }

    getState(): CircuitState {
        return this.state;
    }
}
