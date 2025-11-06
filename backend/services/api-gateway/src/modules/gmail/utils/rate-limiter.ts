import { logger } from "../utils/logger";

/**
 * Rate Limiter with Token Bucket Algorithm
 */
export class RateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   * @param count - Number of tokens to consume
   * @returns true if tokens were consumed, false if not enough tokens
   */
  tryConsume(count: number = 1): boolean {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available
   * @param count - Number of tokens needed
   * @returns Promise that resolves when tokens are available
   */
  async waitForTokens(count: number = 1): Promise<void> {
    this.refill();

    if (this.tokens >= count) {
      this.tokens -= count;
      return;
    }

    const tokensNeeded = count - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * 1000;

    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.tokens = 0; // All tokens consumed after waiting
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Get current token count
   */
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Circuit Breaker States
 */
enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit Breaker for protecting external services
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number; // milliseconds
  private readonly resetTimeout: number; // milliseconds

  constructor(
    failureThreshold: number = 5,
    successThreshold: number = 2,
    timeout: number = 10000,
    resetTimeout: number = 60000
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error("Circuit breaker is OPEN");
      }
      // Try half-open
      this.state = CircuitState.HALF_OPEN;
      logger.info("Circuit breaker transitioning to HALF_OPEN");
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timeout")), this.timeout)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess() {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info("Circuit breaker CLOSED after successful recovery");
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure() {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      this.successCount = 0;
      logger.warn("Circuit breaker OPEN after failure in HALF_OPEN state");
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.resetTimeout;
      logger.warn("Circuit breaker OPEN due to threshold exceeded", { 
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
         });
    }
  }

  /**
   * Get current circuit state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
    logger.info("Circuit breaker manually reset");
  }
}

/**
 * Gmail API Rate Limiter
 * Default quota: 250 units/user/second, 1 billion units/day
 */
export const gmailRateLimiter = new RateLimiter(250, 250); // 250 tokens, refill 250/sec

/**
 * Gmail API Circuit Breaker
 */
export const gmailCircuitBreaker = new CircuitBreaker(
  5, // 5 failures
  2, // 2 successes to close
  10000, // 10s timeout
  60000 // 1min reset
);

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const totalDelay = delay + jitter;

        logger.warn("Retrying after failure", {  attempt: attempt + 1, maxRetries, delay: totalDelay  });

        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }
    }
  }

  throw lastError || new Error("All retries failed");
}
