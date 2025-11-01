import Redis from "ioredis";
/**
 * Redis client for caching and session management
 * Using Upstash Redis with free tier (10,000 commands/day)
 */
export declare const redis: Redis;
export default redis;
