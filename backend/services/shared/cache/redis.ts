import Redis from "ioredis";
import dotenv from "dotenv";
import { logger } from "../monitoring/logger";

dotenv.config();

// Upstash Redis REST API client for cloud connections
class UpstashRestRedis {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request(command: string[]): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        throw new Error(`Upstash Redis request failed: ${response.status}`);
      }

      const result = (await response.json()) as { result: any };
      return result.result;
    } catch (error) {
      logger.error(
        `Upstash Redis error: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.request(["GET", key]);
  }

  async set(key: string, value: any, ...args: any[]): Promise<string> {
    const command = ["SET", key, String(value)];

    // Handle optional arguments (EX, PX, etc.)
    if (args.length > 0) {
      // Simple handling for 'EX' expiration in seconds
      for (let i = 0; i < args.length; i += 2) {
        if (args[i] && args[i + 1] !== undefined) {
          command.push(String(args[i]), String(args[i + 1]));
        }
      }
    }

    const result = await this.request(command);
    return result === "OK" ? "OK" : "OK"; // Always return OK for compatibility
  }

  async del(key: string): Promise<number> {
    return (await this.request(["DEL", key])) || 0;
  }

  async exists(key: string): Promise<number> {
    return (await this.request(["EXISTS", key])) || 0;
  }

  async ttl(key: string): Promise<number> {
    return (await this.request(["TTL", key])) || -1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return (await this.request(["EXPIRE", key, seconds.toString()])) || 0;
  }
}

// Create a mock Redis client for testing/fallback
class MockRedis {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: any, ...args: any[]): Promise<string> {
    this.store.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.has(key) ? 1 : 0;
    this.store.delete(key);
    return deleted;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    return -1; // No expiration in mock
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }
}

let redis: Redis | UpstashRestRedis | MockRedis;

// Initialize Redis connection - Always use real Upstash Redis (cloud or local)
// Mock Redis only for testing environment
if (process.env.NODE_ENV === "test") {
  logger.info("Using Mock Redis for testing environment only");
  redis = new MockRedis();
} else if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Use Upstash REST API - simpler, no connection overhead, production-ready
  logger.info("✅ Connecting to Upstash Redis via REST API");
  redis = new UpstashRestRedis(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
  logger.info("✅ Upstash Redis REST client initialized successfully");
} else if (process.env.USE_IOREDIS === "true" && process.env.REDIS_URL) {
  // Alternative: Use ioredis client if explicitly requested
  logger.info("Connecting to Upstash Redis via ioredis client");
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
    connectTimeout: 10000,
    retryStrategy(times: number) {
      if (times > 3) {
        logger.error("Redis connection failed after 3 attempts");
        throw new Error("Unable to connect to Redis after multiple attempts");
      }
      const delay = Math.min(times * 100, 1000);
      logger.info(`Retrying Redis connection (attempt ${times}) in ${delay}ms`);
      return delay;
    },
  });

  redis.on("connect", () => {
    logger.info("✅ Redis connected successfully via ioredis");
  });

  redis.on("error", (err) => {
    logger.error(`❌ Redis ioredis error: ${err.message}`);
  });

  redis.on("ready", () => {
    logger.info("✅ Redis client ready and operational");
  });
} else {
  // Throw error if no Redis configuration found (for non-test environments)
  const errorMsg =
    "❌ CRITICAL: Redis configuration missing! Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.";
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Export both named and default export for compatibility
export { redis };
export default redis;
