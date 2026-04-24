import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import type { Env } from './types';
import { initDb } from './db/schema';
import { authMiddleware, adminMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import authRouter from './routes/auth';
import queryRouter from './routes/query';
import historyRouter from './routes/history';
import adminRouter from './routes/admin';

// @ts-expect-error -- wrangler generated manifest
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
const manifest = JSON.parse(manifestJSON);

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Run DB init on every cold start; CREATE TABLE IF NOT EXISTS is idempotent.
// A per-isolate flag prevents repeated calls within the same warm isolate.
let dbInitialized = false;
app.use('*', async (c, next) => {
  if (!dbInitialized) {
    await initDb(c.env.APP_DB, c.env.TABLE_PREFIX);
    dbInitialized = true;
  }
  await next();
});

app.use('/api/auth/login', rateLimitMiddleware);

app.route('/api/auth', authRouter);

app.use('/api/query/*', authMiddleware);
app.route('/api/query', queryRouter);

app.use('/api/history/*', authMiddleware);
app.route('/api/history', historyRouter);

app.use('/api/admin/*', authMiddleware, adminMiddleware);
app.route('/api/admin', adminRouter);

// Serve static assets (SPA)
app.get('*', async (c) => {
  try {
    return await getAssetFromKV(
      { request: c.req.raw, waitUntil: (p) => c.executionCtx.waitUntil(p) },
      { ASSET_NAMESPACE: c.env.__STATIC_CONTENT, ASSET_MANIFEST: manifest }
    );
  } catch {
    // SPA fallback
    try {
      const response = await getAssetFromKV(
        {
          request: new Request(new URL('/index.html', c.req.url).toString()),
          waitUntil: (p) => c.executionCtx.waitUntil(p),
        },
        { ASSET_NAMESPACE: c.env.__STATIC_CONTENT, ASSET_MANIFEST: manifest }
      );
      return new Response(response.body, { ...response, status: 200 });
    } catch {
      return c.text('Not Found', 404);
    }
  }
});

export default app;
