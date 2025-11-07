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
      logger.error(`Upstash Redis error: ${error instanceof Error ? error.message : String(error)}`);
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

// Initialize Redis connection with cloud services for local development
// Use REST API by default to avoid connection issues and memory leaks
if (
  process.env.NODE_ENV === "test" ||
  !process.env.REDIS_URL ||
  process.env.REDIS_URL.trim() === ""
) {
  logger.info("Using Mock Redis for testing/fallback");
  redis = new MockRedis();
} else if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Prefer REST API - simpler, no connection overhead, no memory leaks
  logger.info("Using Upstash Redis REST API for cloud connection");
  redis = new UpstashRestRedis(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
} else if (process.env.USE_IOREDIS === "true" && process.env.REDIS_URL) {
  // Only use ioredis if explicitly requested
  try {
    logger.info("Using Upstash Redis with ioredis client (explicit opt-in)");
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 5000,
      retryStrategy(times: number) {
        if (times > 2) {
          logger.warn("Redis connection failed, giving up");
          return null;
        }
        return Math.min(times * 50, 500);
      },
    });

    redis.on("connect", () => {
      logger.info("Redis connected successfully via ioredis");
    });

    redis.on("error", (err) => {
      logger.warn(`Redis ioredis error: ${err.message}`);
    });
  } catch (error) {
    logger.warn("Failed to initialize ioredis, using Mock Redis");
    redis = new MockRedis();
  }
} else {
  logger.info("No Redis configuration found, using Mock Redis");
  redis = new MockRedis();
}

// Export both named and default export for compatibility
export { redis };
export default redis;
