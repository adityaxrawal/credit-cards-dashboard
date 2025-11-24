import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

let redis: Redis | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  console.log('✅ Redis client initialized');
} else {
  console.warn('⚠️ Redis credentials not found. Caching will be disabled.');
}

export default redis;
