import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';

const history = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// GET /api/history
history.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const userId = parseInt(payload.sub);
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    c.env.APP_DB
      .prepare(`SELECT COUNT(*) as cnt FROM ${prefix}_query_history WHERE user_id = ?`)
      .bind(userId)
      .first<{ cnt: number }>(),
    c.env.APP_DB
      .prepare(
        `SELECT h.*, s.display_name as db_name FROM ${prefix}_query_history h
         LEFT JOIN ${prefix}_db_slots s ON s.slot_index = h.slot_index
         WHERE h.user_id = ?
         ORDER BY h.executed_at DESC LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, offset)
      .all(),
  ]);

  return c.json({ history: dataResult.results, total: countResult?.cnt ?? 0 });
});

// DELETE /api/history/:id
history.delete('/:id', async (c) => {
  const payload = c.get('jwtPayload');
  const prefix = c.env.TABLE_PREFIX;
  const userId = parseInt(payload.sub);
  const id = parseInt(c.req.param('id'));

  await c.env.APP_DB
    .prepare(`DELETE FROM ${prefix}_query_history WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();

  return c.json({ ok: true });
});

export default history;
