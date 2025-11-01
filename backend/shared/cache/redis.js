"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is not defined in environment variables");
}
/**
 * Redis client for caching and session management
 * Using Upstash Redis with free tier (10,000 commands/day)
 */
exports.redis = new ioredis_1.default(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError(err) {
        const targetErrors = ["READONLY", "ECONNRESET"];
        if (targetErrors.some((targetError) => err.message.includes(targetError))) {
            // Reconnect on specific errors
            return true;
        }
        return false;
    },
});
exports.redis.on("connect", () => {
    console.log("Redis connected");
});
exports.redis.on("error", (err) => {
    console.error("Redis error:", err);
});
exports.redis.on("close", () => {
    console.log("Redis connection closed");
});
exports.default = exports.redis;
//# sourceMappingURL=redis.js.map