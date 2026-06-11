import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

// Create Redis client with offline queue disabled and reconnection options
export const redis = new Redis(redisUrl, {
  enableOfflineQueue: false, // Do not queue commands when client is offline
  maxRetriesPerRequest: 3,   // Quick fail when Redis goes offline
  retryStrategy(times) {
    // Retry connection up to 3 times, then stop retrying automatically to avoid log spam
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 100, 2000);
  }
});

let isRedisReady = false;

redis.on('ready', () => {
  isRedisReady = true;
  console.log('✅ Redis connected and ready');
});

redis.on('error', (err) => {
  if (isRedisReady) {
    console.warn('⚠️ Redis connection lost');
    isRedisReady = false;
  }
});

redis.on('end', () => {
  isRedisReady = false;
});

export async function getCache(key: string): Promise<string | null> {
  if (!isRedisReady) {
    return null; // Fail-open (skip cache)
  }
  try {
    return await redis.get(key);
  } catch (err) {
    console.warn(`[Redis] getCache failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds = 600): Promise<void> {
  if (!isRedisReady) {
    return; // Fail-open
  }
  try {
    await redis.setex(key, ttlSeconds, value);
  } catch (err) {
    console.warn(`[Redis] setCache failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function invalidateCache(key: string): Promise<void> {
  if (!isRedisReady) {
    return; // Fail-open
  }
  try {
    await redis.del(key);
  } catch (err) {
    console.warn(`[Redis] invalidateCache failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
