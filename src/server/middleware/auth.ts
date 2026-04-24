import { createMiddleware } from 'hono/factory';
import { jwtVerify } from 'jose';
import type { Env, JwtPayload } from '../types';

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.slice(7);
    try {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      c.set('jwtPayload', payload as unknown as JwtPayload);
      await next();
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
  }
);

export const adminMiddleware = createMiddleware<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>(
  async (c, next) => {
    const payload = c.get('jwtPayload');
    if (payload.role !== 'admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  }
);
