import { Hono } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env, JwtPayload } from '../types';

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: number;
  totp_enabled: number;
  email_otp_enabled: number;
  passkey_enabled: number;
  confirm_write_ops: number;
  created_at: number;
};

const admin = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// GET /api/admin/users
admin.get('/users', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const result = await c.env.APP_DB
    .prepare(
      `SELECT id, username, email, role, is_active, totp_enabled, email_otp_enabled, passkey_enabled, confirm_write_ops, created_at
       FROM ${prefix}_users ORDER BY created_at DESC`
    )
    .all<UserRow>();
  return c.json({ users: result.results });
});

// POST /api/admin/users
admin.post('/users', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ username: string; password: string; email?: string; role?: string }>();

  if (!body.username || !body.password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const hash = await bcrypt.hash(body.password, 10);
  const result = await c.env.APP_DB
    .prepare(
      `INSERT INTO ${prefix}_users (username, password_hash, email, role, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
    .bind(body.username, hash, body.email ?? null, body.role ?? 'user', Date.now())
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// GET /api/admin/users/:id
admin.get('/users/:id', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const id = parseInt(c.req.param('id'));

  const user = await c.env.APP_DB
    .prepare(
      `SELECT id, username, email, role, is_active, totp_enabled, email_otp_enabled, passkey_enabled, confirm_write_ops, created_at
       FROM ${prefix}_users WHERE id = ?`
    )
    .bind(id)
    .first<UserRow>();

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json({ user });
});

// PUT /api/admin/users/:id
admin.put('/users/:id', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json<{ username?: string; email?: string }>();

  const setClauses: string[] = [];
  const bindings: (string | null)[] = [];

  if (body.username !== undefined) {
    setClauses.push('username = ?');
    bindings.push(body.username);
  }
  if (body.email !== undefined) {
    setClauses.push('email = ?');
    bindings.push(body.email || null);
  }

  if (setClauses.length === 0) return c.json({ ok: true });

  bindings.push(String(id));
  let stmt = c.env.APP_DB.prepare(
    `UPDATE ${prefix}_users SET ${setClauses.join(', ')} WHERE id = ?`
  );
  for (const b of bindings) {
    stmt = stmt.bind(b);
  }
  await stmt.run();

  return c.json({ ok: true });
});

// DELETE /api/admin/users/:id
admin.delete('/users/:id', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const id = parseInt(c.req.param('id'));
  const requestor = c.get('jwtPayload');

  if (String(id) === requestor.sub) {
    return c.json({ error: 'Cannot delete your own account' }, 400);
  }

  await c.env.APP_DB.prepare(`DELETE FROM ${prefix}_users WHERE id = ?`).bind(id).run();
  await c.env.APP_DB.prepare(`DELETE FROM ${prefix}_sessions WHERE user_id = ?`).bind(id).run();
  await c.env.APP_DB.prepare(`DELETE FROM ${prefix}_db_permissions WHERE user_id = ?`).bind(id).run();

  return c.json({ ok: true });
});

// PUT /api/admin/users/:id/role
admin.put('/users/:id/role', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json<{ role: string }>();

  if (!['admin', 'user'].includes(body.role)) {
    return c.json({ error: 'Invalid role' }, 400);
  }

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET role = ? WHERE id = ?`)
    .bind(body.role, id)
    .run();

  return c.json({ ok: true });
});

// PUT /api/admin/users/:id/status
admin.put('/users/:id/status', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json<{ is_active: boolean }>();

  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET is_active = ? WHERE id = ?`)
    .bind(body.is_active ? 1 : 0, id)
    .run();

  return c.json({ ok: true });
});

// POST /api/admin/users/:id/reset-password
admin.post('/users/:id/reset-password', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const id = parseInt(c.req.param('id'));
  const body = await c.req.json<{ password: string }>();

  if (!body.password || body.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  const hash = await bcrypt.hash(body.password, 10);
  await c.env.APP_DB
    .prepare(`UPDATE ${prefix}_users SET password_hash = ? WHERE id = ?`)
    .bind(hash, id)
    .run();

  // Invalidate all sessions for this user
  await c.env.APP_DB
    .prepare(`DELETE FROM ${prefix}_sessions WHERE user_id = ?`)
    .bind(id)
    .run();

  return c.json({ ok: true });
});

// GET /api/admin/db-slots
admin.get('/db-slots', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const result = await c.env.APP_DB
    .prepare(`SELECT slot_index, display_name, is_active FROM ${prefix}_db_slots ORDER BY slot_index`)
    .all<{ slot_index: number; display_name: string; is_active: number }>();
  return c.json({ slots: result.results });
});

// PUT /api/admin/db-slots/:slotIndex
admin.put('/db-slots/:slotIndex', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const slotIndex = parseInt(c.req.param('slotIndex'));
  const body = await c.req.json<{ display_name?: string; is_active?: boolean }>();

  await c.env.APP_DB
    .prepare(
      `UPDATE ${prefix}_db_slots SET
         display_name = COALESCE(?, display_name),
         is_active = COALESCE(?, is_active)
       WHERE slot_index = ?`
    )
    .bind(
      body.display_name ?? null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : null,
      slotIndex
    )
    .run();

  return c.json({ ok: true });
});

// GET /api/admin/permissions/:userId
admin.get('/permissions/:userId', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const userId = parseInt(c.req.param('userId'));

  const result = await c.env.APP_DB
    .prepare(`SELECT slot_index FROM ${prefix}_db_permissions WHERE user_id = ?`)
    .bind(userId)
    .all<{ slot_index: number }>();

  return c.json({ slots: result.results.map((r) => r.slot_index) });
});

// PUT /api/admin/permissions/:userId
admin.put('/permissions/:userId', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const userId = parseInt(c.req.param('userId'));
  const body = await c.req.json<{ slots: number[] }>();

  // Delete existing and re-insert
  await c.env.APP_DB
    .prepare(`DELETE FROM ${prefix}_db_permissions WHERE user_id = ?`)
    .bind(userId)
    .run();

  for (const slotIndex of body.slots) {
    await c.env.APP_DB
      .prepare(`INSERT OR IGNORE INTO ${prefix}_db_permissions (user_id, slot_index) VALUES (?, ?)`)
      .bind(userId, slotIndex)
      .run();
  }

  return c.json({ ok: true });
});

// GET /api/admin/history
admin.get('/history', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const userId = c.req.query('userId') ? parseInt(c.req.query('userId') as string) : null;
  const slotIndex = c.req.query('slotIndex') ? parseInt(c.req.query('slotIndex') as string) : null;
  const page = parseInt(c.req.query('page') ?? '1');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const bindings: (number | string)[] = [];

  if (userId !== null) {
    whereClause += ' AND h.user_id = ?';
    bindings.push(userId);
  }
  if (slotIndex !== null) {
    whereClause += ' AND h.slot_index = ?';
    bindings.push(slotIndex);
  }

  const countStmt = c.env.APP_DB.prepare(
    `SELECT COUNT(*) as cnt FROM ${prefix}_query_history h WHERE ${whereClause}`
  );
  const dataStmt = c.env.APP_DB.prepare(
    `SELECT h.*, u.username, s.display_name as db_name
     FROM ${prefix}_query_history h
     LEFT JOIN ${prefix}_users u ON u.id = h.user_id
     LEFT JOIN ${prefix}_db_slots s ON s.slot_index = h.slot_index
     WHERE ${whereClause}
     ORDER BY h.executed_at DESC LIMIT ? OFFSET ?`
  );

  // Bind parameters
  let boundCount = countStmt;
  let boundData = dataStmt;
  for (const b of bindings) {
    boundCount = boundCount.bind(b);
    boundData = boundData.bind(b);
  }
  boundData = boundData.bind(limit).bind(offset);

  const [countResult, dataResult] = await Promise.all([
    boundCount.first<{ cnt: number }>(),
    boundData.all(),
  ]);

  return c.json({ history: dataResult.results, total: countResult?.cnt ?? 0 });
});

// GET /api/admin/settings
admin.get('/settings', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const result = await c.env.APP_DB
    .prepare(`SELECT key, value FROM ${prefix}_settings`)
    .all<{ key: string; value: string }>();
  return c.json({ settings: result.results });
});

// PUT /api/admin/settings
admin.put('/settings', async (c) => {
  const prefix = c.env.TABLE_PREFIX;
  const body = await c.req.json<{ key: string; value: string }>();

  if (!body.key || body.value === undefined) {
    return c.json({ error: 'Key and value required' }, 400);
  }

  await c.env.APP_DB
    .prepare(`INSERT OR REPLACE INTO ${prefix}_settings (key, value) VALUES (?, ?)`)
    .bind(body.key, body.value)
    .run();

  return c.json({ ok: true });
});

export default admin;
