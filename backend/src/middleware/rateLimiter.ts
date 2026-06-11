import { Request, Response, NextFunction } from 'express';
import { redis } from '../services/cache.service';

export async function chatRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check if Redis is ready/connected
  if (redis.status !== 'ready') {
    return next(); // Fail-open
  }

  const sessionId = req.body.sessionId || req.ip || 'anonymous';
  const key = `ratelimit:${sessionId}`;
  const limit = 10;          // Max requests
  const windowSeconds = 60;  // Per 60 seconds

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
