import { createMiddleware } from 'hono/factory';
import type { Env } from '../types';

const attempts = new Map<string, { count: number; resetAt: number }>();

export const rateLimitMiddleware = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const now = Date.now();
  const entry = attempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) {
      return c.json({ error: 'Too many requests, please try again later' }, 429);
    }
    entry.count++;
  } else {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  await next();
});
