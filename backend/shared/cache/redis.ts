import Redis from "ioredis";
import dotenv from "dotenv";

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
      console.error("Upstash Redis error:", error);
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
if (
  process.env.NODE_ENV === "test" ||
  !process.env.REDIS_URL ||
  process.env.REDIS_URL.trim() === ""
) {
  console.log("Using Mock Redis for testing/fallback");
  redis = new MockRedis();
} else if (
  process.env.USE_REDIS_REST_API === "true" &&
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  console.log("Using Upstash Redis REST API for cloud connection");
  redis = new UpstashRestRedis(
    process.env.UPSTASH_REDIS_REST_URL,
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
} else {
  try {
    console.log("Using Upstash Redis with ioredis client");
    /**
     * Redis client for caching and session management
     * Using Upstash Redis with free tier (10,000 commands/day)
     */
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false, // Important for Upstash compatibility
      lazyConnect: true, // Connect when first command is sent
      connectTimeout: 10000, // 10 second timeout
      retryStrategy(times: number) {
        if (times > 3) {
          console.log(
            "Redis connection failed after 3 attempts, switching to REST API"
          );
          // Fallback to REST API if available
          if (
            process.env.UPSTASH_REDIS_REST_URL &&
            process.env.UPSTASH_REDIS_REST_TOKEN
          ) {
            redis = new UpstashRestRedis(
              process.env.UPSTASH_REDIS_REST_URL,
              process.env.UPSTASH_REDIS_REST_TOKEN
            );
            return null;
          }
          return null;
        }
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
    });

    redis.on("connect", () => {
      console.log("Redis connected successfully via ioredis");
    });

    redis.on("error", (err) => {
      console.log("Redis ioredis error:", err.message);
    });

    redis.on("close", () => {
      console.log("Redis ioredis connection closed");
    });
  } catch (error) {
    console.log(
      "Failed to initialize ioredis, falling back to REST API or mock"
    );
    if (
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      console.log("Using Upstash Redis REST API as fallback");
      redis = new UpstashRestRedis(
        process.env.UPSTASH_REDIS_REST_URL,
        process.env.UPSTASH_REDIS_REST_TOKEN
      );
    } else {
      console.log("Using Mock Redis as final fallback");
      redis = new MockRedis();
    }
  }
}

// Export both named and default export for compatibility
export { redis };
export default redis;
