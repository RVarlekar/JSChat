import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/cache.service';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitInfo>();

// Clean up expired entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of memoryStore.entries()) {
    if (now > info.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 60000).unref();

export async function chatRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const limit = parseInt(process.env.RATE_LIMIT_MAX || '10', 10);          // Max requests
  const windowSeconds = parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10);  // Per 60 seconds
  const sessionId = req.body.sessionId || req.ip || 'anonymous';
  const key = `ratelimit:${sessionId}`;

  // Check if Redis is ready/connected
  if (redis.status !== 'ready') {
    // In-memory rate limiting fallback when Redis is offline
    const now = Date.now();
    let info = memoryStore.get(key);
    if (!info || now > info.resetTime) {
      info = {
        count: 0,
        resetTime: now + windowSeconds * 1000,
      };
    }

    info.count += 1;
    memoryStore.set(key, info);

    if (info.count > limit) {
      res.status(429).json({
        error: 'Too many messages. Please wait a moment before sending another message.'
      });
      return;
    }
    return next();
  }

  try {
    const requests = await redis.incr(key);

    if (requests === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (requests > limit) {
      res.status(429).json({
        error: 'Too many messages. Please wait a moment before sending another message.'
      });
      return;
    }

    next();
  } catch (err) {
    console.warn(`[Redis] Rate limiter error: ${err instanceof Error ? err.message : String(err)}`);
    next(); // Fail-open
  }
}
