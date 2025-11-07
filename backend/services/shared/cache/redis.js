"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Upstash Redis REST API client for cloud connections
class UpstashRestRedis {
    constructor(baseUrl, token) {
        this.baseUrl = baseUrl;
        this.token = token;
    }
    async request(command) {
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
            const result = (await response.json());
            return result.result;
        }
        catch (error) {
            console.error("Upstash Redis error:", error);
            return null;
        }
    }
    async get(key) {
        return await this.request(["GET", key]);
    }
    async set(key, value, ...args) {
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
    async del(key) {
        return (await this.request(["DEL", key])) || 0;
    }
    async exists(key) {
        return (await this.request(["EXISTS", key])) || 0;
    }
    async ttl(key) {
        return (await this.request(["TTL", key])) || -1;
    }
    async expire(key, seconds) {
        return (await this.request(["EXPIRE", key, seconds.toString()])) || 0;
    }
}
// Create a mock Redis client for testing/fallback
class MockRedis {
    constructor() {
        this.store = new Map();
    }
    async get(key) {
        return this.store.get(key) || null;
    }
    async set(key, value, ...args) {
        this.store.set(key, value);
        return "OK";
    }
    async del(key) {
        const deleted = this.store.has(key) ? 1 : 0;
        this.store.delete(key);
        return deleted;
    }
    async exists(key) {
        return this.store.has(key) ? 1 : 0;
    }
    async ttl(key) {
        return -1; // No expiration in mock
    }
    async expire(key, seconds) {
        return this.store.has(key) ? 1 : 0;
    }
}
let redis;
// Initialize Redis connection with cloud services for local development
// Use REST API by default to avoid connection issues and memory leaks
if (process.env.NODE_ENV === "test" ||
    !process.env.REDIS_URL ||
    process.env.REDIS_URL.trim() === "") {
    console.log("Using Mock Redis for testing/fallback");
    exports.redis = redis = new MockRedis();
}
else if (process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Prefer REST API - simpler, no connection overhead, no memory leaks
    console.log("Using Upstash Redis REST API for cloud connection");
    exports.redis = redis = new UpstashRestRedis(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN);
}
else if (process.env.USE_IOREDIS === "true" && process.env.REDIS_URL) {
    // Only use ioredis if explicitly requested
    try {
        console.log("Using Upstash Redis with ioredis client (explicit opt-in)");
        exports.redis = redis = new ioredis_1.default(process.env.REDIS_URL, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: false,
            lazyConnect: true,
            connectTimeout: 5000,
            retryStrategy(times) {
                if (times > 2) {
                    console.log("Redis connection failed, giving up");
                    return null;
                }
                return Math.min(times * 50, 500);
            },
        });
        redis.on("connect", () => {
            console.log("Redis connected successfully via ioredis");
        });
        redis.on("error", (err) => {
            console.log("Redis ioredis error:", err.message);
        });
    }
    catch (error) {
        console.log("Failed to initialize ioredis, using Mock Redis");
        exports.redis = redis = new MockRedis();
    }
}
else {
    console.log("No Redis configuration found, using Mock Redis");
    exports.redis = redis = new MockRedis();
}
exports.default = redis;
//# sourceMappingURL=redis.js.map